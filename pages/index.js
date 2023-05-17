import React from 'react'
import styles from '../styles/Index.module.css'
import { initFirebase } from '../lib/firebaseApp'
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from '../lib/firebaseApp'
import { storage } from '../lib/firebaseApp'
import { ref, uploadBytes, listAll, getDownloadURL, deleteObject } from 'firebase/storage'
import { v4 } from 'uuid'
import Image from 'next/image'

function login() {

    const [user, setUser] = useState(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [newNotebookName, setNewNotebookName] = useState("")
    const [notebooks, setNotebooks] = useState([])
    const [pdfsScheduledForDeletion, setPdfsScheduledForDeletion] = useState([])
    const [createNotebookFormVisible, setCreateNotebookFormVisible] = useState(false)
    const [recents, setRecents] = useState([])

    //keep user logged in
    useEffect(() => {
        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log(user)
                setUser(user)
                setLoggedIn(true)
            } else {
                setUser(null)
                setLoggedIn(false)
            }
        });
    }, [])

    useEffect(() => {
        if (user) {
            checkifUserExists().then(
                (response) => {
                    if (response) {
                    } else {
                        createUser()
                    }
                    setLoggedIn(true)
                    fetchNotebookNames()
                }
            )
        }
    }, [user])

    //whenever the notebookData changes run fetch recents
    useEffect(() => {
        if (user) {
            //if the recents array is empty, fetch recents DEBUG (this wasn't thought out but probably works)
            if (recents.length == 0) {
                fetchRecents()
            }
        }
    }, [notebooks])


    const login = () => {
        const auth = getAuth();
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                setUser(result.user)
                window.location.href = "/home"
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
            // An error happened.
            console.log(error)
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

    const createNotebook = async () => {
        const notebookRef = doc(db, "notebooks", v4());
        await setDoc(notebookRef, {
            name: `${newNotebookName}`,
            editors: [user.uid],
            viewers: [],
            pdfs: [],
            uid: `${notebookRef.id}`,
        })
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data()
            data.notebooks.push(notebookRef.id)
            await setDoc(userRef, data)
        }
        fetchNotebookNames()
        setNewNotebookName("")
        setCreateNotebookFormVisible(false)
    }

    const fetchNotebookNames = async () => {
        setNotebooks([])
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data()
            const notebooks = data.notebooks
            notebooks.forEach(async (notebook) => {
                const notebookRef = doc(db, "notebooks", notebook);
                const notebookSnap = await getDoc(notebookRef);
                if (notebookSnap.exists()) {
                    const notebookData = notebookSnap.data()
                    let noteBookObject = {
                        name: notebookData.name,
                        uid: notebookData.uid,
                    }
                    setNotebooks((notebooks) => [...notebooks, noteBookObject])
                }
            })
        }
    }

    const fetchRecents = async () => {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            setRecents([])
            const data = docSnap.data()
            const recents = data.recents
            if (recents == undefined) {
                return
            }
            recents.forEach(async (recent) => {
                const recentRef = doc(db, "notebooks", recent);
                const recentSnap = await getDoc(recentRef);
                if (recentSnap.exists()) {
                    const recentData = recentSnap.data()
                    let recentObject = {
                        name: recentData.name,
                        uid: recentData.uid,
                    }
                    setRecents((recents) => [...recents, recentObject])
                }
            }
            )
        }
    }

    const deleteNotebook = async (notebook) => {

        //remove the notebook from the recent list of users in the viewers list
        const notebookRef3 = doc(db, "notebooks", notebook.uid);
        const notebookSnap3 = await getDoc(notebookRef3);
        if (notebookSnap3.exists()) {
            const notebookData3 = notebookSnap3.data()
            notebookData3.viewers.forEach(async (viewer) => {
                const userRef = doc(db, "users", viewer);
                const docSnap = await getDoc(userRef);
                if (docSnap.exists()) {
                    const data = docSnap.data()
                    const recents = data.recents
                    const index = recents.indexOf(notebook.uid)
                    recents.splice(index, 1)
                    await setDoc(userRef, data)
                }
            })
        }

        //grab the notebook
        const notebookRef = doc(db, "notebooks", notebook.uid);
        const notebookSnap = await getDoc(notebookRef);
        if (notebookSnap.exists()) {
            const notebookData = notebookSnap.data()
            //delete the pdfs
            notebookData.pdfs.forEach(async (pdf) => {
                const pdfRef = ref(storage, `pdfs/${pdf.uid}`)
                await deleteObject(pdfRef)
            })
            //remove the notebook from the user
            const notebookRef2 = doc(db, "notebooks", notebook.uid);
            await deleteDoc(notebookRef2);
            const userRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                const data = docSnap.data()
                const notebooks = data.notebooks
                const index = notebooks.indexOf(notebook.uid)
                notebooks.splice(index, 1)
                await setDoc(userRef, data)
            }
            fetchNotebookNames()
        }
    }

    //copy the url of the pdf to the clipboard
    const shareNotebook = (url) => {
        navigator.clipboard.writeText(url).then(() => {
            alert("Shareable link copied to clipboard")
        }, () => {
            alert("Browser not supported. Try Chrome or copy notebook link manually.")
        });
    }



    return (
        <>
            {
                !loggedIn &&
                <>
                    <div className={styles['container']}>
                        <h1 className={styles['title']}>Noodle Notebook</h1>
                        <p className={styles['description']}>a search engine for the classroom</p>
                        <button className={styles['login']} onClick={login}>Get Started</button>
                    </div>
                </>

            }
            {
                loggedIn &&
                <div>
                    <div className={styles['header']}>
                        <div className={styles['name-container']}>
                            <p className={styles['name']} >{user.displayName.split(" ")[0]}</p>
                            <button className={styles['plus']} onClick={() => setCreateNotebookFormVisible(!createNotebookFormVisible)}>+</button>
                        </div>
                        <button className={styles['logout']} onClick={logout}>Log Out</button>
                    </div>
                    <h2 className={styles['title']}>My Notebooks</h2>
                    <div className={styles['notebooks-container']}>
                        {
                            notebooks.map((notebook) => {
                                return (
                                    <div className={styles['notebook-container']}>
                                        <a className={styles['notebook-box']} href={`/notebook/${notebook.uid}`}>
                                            {notebook.name}
                                        </a>
                                        <div className={styles['notebook-footer']}>
                                            <button className={styles['notebook-delete']}><Image onClick={() => { deleteNotebook(notebook) }} alt="trashcan/delete" src="/trash.svg" width={25} height={25} /></button>
                                            <button className={styles['notebook-share']}><Image onClick={() => { shareNotebook(`https://noodlenotebook.com/notebook/${notebook.uid}`) }} alt="share" src="/share.svg" width={35} height={35} /></button>
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </div>
                    <h2 className={styles['title']}>Shared Notebooks</h2>
                    <div className={styles['recents-container']}>
                        {
                            recents.map((recent) => {
                                return (
                                    <div className={styles['recent-container']}>
                                        <a className={styles['recent-box']} href={`/notebook/${recent.uid}`}>
                                            {recent.name}
                                        </a>
                                    </div>
                                )
                            })
                        }
                    </div>
                    {
                        createNotebookFormVisible &&
                        <div className={styles['create-notebook-form']}>
                            <div className={styles['background']} onClick={() => setCreateNotebookFormVisible(!createNotebookFormVisible)}></div>
                            <div className={styles['create-notebook-form-container']}>
                                <input className={styles['create-notebook-form-input']} type="text" placeholder="Title" onChange={(e) => setNewNotebookName(e.target.value)} />
                                <button className={styles['create-notebook-form-button']} onClick={createNotebook}>Create Notebook</button>
                            </div>
                        </div>
                    }
                </div>
            }
        </>
    )
}

export default login