import React from 'react'
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, useRef } from 'react'
import { doc, getDoc, setDoc } from "firebase/firestore";
import { initFirebase, storage, db } from '../../lib/firebaseApp'
import { ref, uploadBytes, listAll, getDownloadURL } from 'firebase/storage'
import { v4 } from 'uuid'
import { useRouter } from 'next/router'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import styles from '../../styles/Notebook.module.css'
import { deleteObject } from "firebase/storage";
import Image from 'next/image'
import Transcript from '../../Components/Transcript';
import Head from 'next/head'

function notebook(req, res) {

    let { uid } = useRouter().query

    const [user, setUser] = useState(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [newNotebookName, setNewNotebookName] = useState("")
    const [notebooks, setNotebooks] = useState([])
    const [notebookData, setNotebookData] = useState([])
    const [mergedPdfSrc, setMergedPdfSrc] = useState("https://noodlenotebook.com/loading.pdf")

    const [pdfUpload, setPdfUpload] = useState(null);

    const [editMenuVisible, setEditMenuVisible] = useState(false)

    const fileRef = useRef(null)

    const [initialLoadComplete, setInitialLoadComplete] = useState(false)
    const [secondLoadComplete, setSecondLoadComplete] = useState(false)

    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploading, setUploading] = useState(false)

    const [swap, setSwap] = useState('Slides')

    const [url, setUrl] = useState('')

    useEffect(() => {
        const handleTabKey = (event) => {
          if (event.key === 'Tab') {
            event.preventDefault();
            const swapButton = document.querySelector(`.${styles['swap']}`);
            swapButton.click();
          }
        };
        document.addEventListener('keydown', handleTabKey);
        return () => {
          document.removeEventListener('keydown', handleTabKey);
        };
      }, []);

    useEffect(() => {
        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user)
                setLoggedIn(true)
                getNotebook()
            } else {
                setUser(null)
                setLoggedIn(false)
            }
        });
        if (initialLoadComplete) {
            setSecondLoadComplete(true)
        }
        setInitialLoadComplete(true);
    }, [user])

    //the data is returned piecemeal and as a result gets set as undefined temporarily, creating the need to update it as it returns
    //we can fix this by breaking things up into smaller state instead of a big object, but that will take a lot of code, best to keep things simple for now
    useEffect(() => {
        if (!notebookData.name || !notebookData.name || !notebookData.editors || !notebookData.viewers) {
            getNotebook()
        }
    }, [notebookData])

    //add the notebook to the user's recents list
    useEffect(() => {
        if (user && notebookData.editors) {
            if (!notebookData.editors.includes(user.uid)) {
                const userRef = doc(db, "users", user.uid);
                getDoc(userRef).then((doc) => {
                    if (doc.exists()) {
                        let recents = doc.data().recents
                        if (!recents) {
                            recents = []
                        }
                        if (!recents.includes(uid)) {
                            recents.push(uid)
                            setDoc(userRef, {
                                recents: recents
                            }, { merge: true })
                        }
                    }
                }
                )
            }
            //add the user to the notebook's viewers list if they aren't an editor
            if (!notebookData.viewers.includes(user.uid) && !notebookData.editors.includes(user.uid)) {
                const notebookRef = doc(db, "notebooks", uid);
                getDoc(notebookRef).then((doc) => {
                    if (doc.exists()) {
                        let viewers = doc.data().viewers
                        if (!viewers) {
                            viewers = []
                        }
                        if (!viewers.includes(user.uid)) {
                            viewers.push(user.uid)
                            setDoc(notebookRef, {
                                viewers: viewers
                            }, { merge: true })
                        }
                    }
                }
                )
            }
        }
    }, [user, notebookData])



    const getNotebook = async () => {
        if (!uid) return
        const notebookRef = doc(db, "notebooks", uid);
        const notebookDoc = await getDoc(notebookRef);
        if (notebookDoc.exists()) {
            console.log("Document data:", notebookDoc.data());
            setNotebookData(notebookDoc.data())
            return notebookDoc.data()
        } else {
            return null
        }
    }

    const downloadAllPdfBtyeData = async () => {
        let pdfByteDataArray = []
        for (let i = 0; i < notebookData.pdfs.length; i++) {
            const pdfRef = ref(storage, "pdfs/" + notebookData.pdfs[i].uid);
            const url = await getDownloadURL(pdfRef);
            let pdfByteData = await fetch(url).then(res => res.arrayBuffer())
            pdfByteDataArray.push(pdfByteData)
        }
        return pdfByteDataArray
    }

    useEffect(() => {
        if (notebookData.pdfs) {
            merge()
        }
    }, [notebookData.pdfs])

    useEffect(() => {
        if (notebookData.url) {
            setUrl(notebookData.url)
        }
    }, [notebookData.url])

    async function merge() {
        downloadAllPdfBtyeData().then(
            async (pdfByteDataArray) => {
                const mergedPdf = await PDFDocument.create();
                for (let i = 0; i < pdfByteDataArray.length; i++) {
                    let bytes = await readFileAsync(pdfByteDataArray[i]);
                    const pdf = await PDFDocument.load(bytes);
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }
                const mergedPdfFile = await mergedPdf.save();
                displayMergedPdf(mergedPdfFile);
            }
        )
    }
    async function displayMergedPdf(mergedPdfFile) {
        setMergedPdfSrc(URL.createObjectURL(new Blob([mergedPdfFile], { type: 'application/pdf' })));
    }
    function readFileAsync(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            file = new Blob([file], { type: 'application/pdf' })
            reader.readAsArrayBuffer(file);
        })
    }

    const uploadFiles = () => {
        if (pdfUpload == null) return;
        setUploading(true)
        let pdfs = []
        for (let i = 0; i < pdfUpload.length; i++) {
            let identifier = v4()
            const pdfRef = ref(storage, `pdfs/${identifier}`);
            uploadBytes(pdfRef, pdfUpload[i]).then((snapshot) => {
                getDownloadURL(snapshot.ref).then((url) => {
                    pdfs.push({ uid: identifier, name: pdfUpload[i].name })
                    if (pdfs.length == pdfUpload.length) {
                        const notebookRef = doc(db, "notebooks", uid);
                        setDoc(notebookRef, {
                            pdfs: [...notebookData.pdfs, ...pdfs]
                        }, { merge: true });
                    }
                }).then(() => {
                    getNotebook()
                    setUploading(false)
                });
            });
        }
    };

    const login = () => {
        const auth = getAuth();
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                setUser(result.user)
            }).catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                const email = error.email;
                const credential = GoogleAuthProvider.credentialFromError(error);
            });
    }

    const logout = () => {
        const auth = getAuth();
        auth.signOut().then(() => {
            setUser(null)
            setLoggedIn(false)
        }).catch((error) => {
            alert(error)
        });
    }

    const checkifUserExists = async () => {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return true
        }
        return false
    }

    const createUser = async () => {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
            notebooks: [],
            email: `${user.email}`,
            uid: `${user.uid}`,
        })
    }

    useEffect(() => {
        if (user) {
            checkifUserExists().then(
                (response) => {
                    if (response) {
                    } else {
                        createUser()
                    }
                }
            )
        }
    }, [user])

    const deletePDF = async (uid) => {
        //remove the reference from notebooks->notebookUID->pdfs[]->pdfs.uid
        const notebookRef = doc(db, "notebooks", notebookData.uid);
        const notebookDoc = await getDoc(notebookRef);
        if (notebookDoc.exists()) {
            let pdfs = notebookDoc.data().pdfs
            pdfs = pdfs.filter((pdf) => pdf.uid != uid)
            setDoc(notebookRef, {
                pdfs: pdfs
            }, { merge: true });
        }
        //then remove the actual file from storage
        const pdfRef = ref(storage, "pdfs/" + uid);
        deleteObject(pdfRef).then(() => {
            getNotebook()
        }
        ).catch((error) => {
            alert(error)
        }
        );
    }

    const swapFunc = () => {
        if (swap == 'Slides') {
            setSwap('Transcript');
        }
        else if (swap == 'Transcript') {
            setSwap('Slides');
        }
    }

    useEffect(() => {
        uploadFiles();
        getNotebook()
    }, [pdfUpload])

    useEffect(() => {
        if (url) {
            const notebookRef = doc(db, "notebooks", uid);
            setDoc(notebookRef, {
                url: url
            }, { merge: true });
        }
    }, [url])

    return (
        <>
            <Head>
                <title>Noodle Notebook</title>
            </Head>
            {
                loggedIn &&
                <>
                    {
                        notebookData &&
                        <>
                            <div className={styles['header']}>
                                <a className={styles['back']} href="../home">&larr;</a>
                                <p className={styles['title']}>{notebookData.name}</p>
                                <div className={styles['fore-front']}>
                                    <button className={styles['swap']} onClick={swapFunc}>{swap}</button>
                                    <button className={styles['edit']} onClick={() => setEditMenuVisible(!editMenuVisible)}>Edit</button>
                                </div>

                            </div>
                            {
                                (notebookData.pdfs && editMenuVisible) &&
                                <>
                                    <div className={styles['edit-menu-container']}>
                                        <div className={styles['background']} onClick={() => setEditMenuVisible(!editMenuVisible)}></div>
                                        <div className={styles['edit-menu']}>
                                            <p className={styles['pdf-title']}>PDFS</p>
                                            <div className={styles['pdf-items-container']}>
                                                {
                                                    notebookData.pdfs.map((pdf) => {
                                                        return (
                                                            <div className={styles['pdf-item-container']}>
                                                                <p>{pdf.name}</p>
                                                                {
                                                                    (notebookData.editors && notebookData.editors.includes(user.uid)) &&
                                                                    <button className={styles['pdf-delete']}><Image onClick={() => { deletePDF(pdf.uid) }} alt="trashcan/delete" src="/trash.svg" width={25} height={25} /></button>
                                                                }
                                                            </div>
                                                        )
                                                    }
                                                    )
                                                }
                                            </div>
                                            <div className={styles['pdf-upload-container']}>
                                                {
                                                    !uploading && <button className={styles['pdf-input-files']} onClick={() => fileRef.current?.click()}>Upload</button>
                                                }
                                                {
                                                    uploading && <p>Uploading...</p>
                                                }
                                                <input
                                                    type='file'
                                                    accept=".pdf"
                                                    multiple
                                                    ref={fileRef}
                                                    onChange={(event) => {
                                                        setPdfUpload(event.target.files);
                                                    }}
                                                    style={{ display: "none" }} />
                                            </div>
                                            <div className={styles['url-container']}>
                                                <p className={styles['url-title']}>Transcript</p>
                                                <input className={styles['url-input']} type="text" value={url} onChange={(event) => setUrl(event.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            }
                        </>
                    }
                    {
                        swap == 'Slides' &&
                        <>
                            <div className={styles['embed-container']} id="embed-container">
                                <embed id="embed" src={`${mergedPdfSrc}`} type="application/pdf" width="100%" height="100%" />
                            </div>
                        </>
                    }
                    {
                        swap == 'Transcript' &&
                        <>
                            <Transcript playlistId={url.split("list=")[1]} />
                        </>
                    }
                </>
            }
            {
                (!loggedIn && secondLoadComplete) &&
                <div className={styles['login-container']}>
                    <p className={styles['login-title']}>Login To Access Noodle Notebook</p>
                    <button className={styles['login-button']} onClick={login}>Login</button>
                </div>
            }
        </>
    )
}

export default notebook