'use client';

import * as React from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
/* import { ChevronsDown, ChevronsLeft, ChevronsUp, Repeat } from 'react-feather' */
import { PDFViewer, NavigationHandle } from './PDFViewer'

// styles 
import styles from '../styles/v2.module.css';
import ResTable from '../Components/ResTable';

type FileWithPageData = {
    resultIndex: number;
    fileName: string;
    fileData: Uint8Array;
    currentPage: number;
};

export default function Search() {
    // set worker
    const workerRef = useRef<Worker | null>(null);
    const navigationRef = useRef<NavigationHandle>(null);

    // search enabled state
    const [expanded, setExpanded] = useState(false);

    // header state
    const [headerHidden, setHeaderHidden] = useState(false);

    // search state
    const [search, setSearch] = useState("");
    const [searchEnabled, setSearchEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<string[]>([]);

    // pdf viewer state
    const [showPdf, setShowPdf] = useState(false);
    const [fileCount, setFileCount] = useState(0);
    const [fileNameToData, setFileNameToData] = useState<{ [key: string]: Uint8Array }>({});

    const [currentPdf, setCurrentPdf] = useState<FileWithPageData>({
        resultIndex: -1,
        fileName: "",
        fileData: new Uint8Array(),
        currentPage: 0
    });

    const toggleHeader = () => {
        setHeaderHidden(!headerHidden);
    }

    const pdfgrep = () => {
        if (workerRef.current && !loading && searchEnabled && search.length > 0) {
            setResults([]);
            setLoading(true);
            workerRef.current.postMessage({ query: search });
        }
    }

    useEffect(() => {
        if (workerRef.current == null) {
            // set worker
            workerRef.current = new Worker('/dist/pdfgrep_worker.js');
            workerRef.current.onmessage = ({ data: { searchResult, singleFileData, fileData, exception, print } }) => {
                if (searchResult) {
                    setLoading(false);
                    if (searchResult.exit_code !== 0 && searchResult.stderr.length > 0) {
                        const stderr = searchResult.stderr.trim().split('\n').filter((l: string) => !l.startsWith("program exited"));
                        if (stderr.length > 0) {
                            setResults(results => [...results, searchResult.stderr]);
                        }
                    }
                } else if (singleFileData) {
                    setCurrentPdf(singleFileData);
                } else if (fileData) {
                    setFileCount(fileData.fileCount);
                    setFileNameToData(fileData.fileNameToData);
                    const fileNames = Object.keys(fileData.fileNameToData);
                    setCurrentPdf({
                        resultIndex: -1,
                        fileName: fileNames[0],
                        fileData: fileData.fileNameToData[fileNames[0]],
                        currentPage: 0
                    });
                } else if (exception) {
                    console.error(exception);
                } else if (print) {
                    // add line to results
                    setResults(results => [...results, print]);
                } else {
                    console.error("Unknown message", searchResult, fileData, exception, print);
                }
            };
            workerRef.current.postMessage({ pdfgrep_wasm: "/dist/pdfgrep.wasm", pdfgrep_js: "/dist/pdfgrep.js" });
        }
    }, []);

    // disable the search if loading
    useEffect(() => {
        if (!loading && search !== "") {
            setSearchEnabled(true);
        } else {
            setSearchEnabled(false);
        }
    }, [loading, search]);

    
    function Dropzone() {
        const onDrop = useCallback((acceptedFiles: File[]) => {
            if (workerRef.current) {
                // Filter out non-pdf files
                const pdfs = acceptedFiles.filter(f => f.type === "application/pdf");
                // Upload the files
                workerRef.current.postMessage({ files: pdfs });
            } else {
                console.error("workerRef.current is null");
            }
        }, []);
        const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })
        return (
            <div {...getRootProps()} className={styles.dropzone}>
                <input {...getInputProps()} />
                {
                    isDragActive ?
                        <p>Drop the files here ...</p> :
                        <p>Drag 'n' drop some files here, or click to select files</p>
                }
            </div>
        )
    }
        

    return (
        <>

            <div className={headerHidden || (showPdf && !expanded) ? styles.headerContentHidden : styles.headerContent}>
                <Dropzone />
            </div>

            <form className={styles.search + " " + (expanded ? styles.expanded : "")}>
                <input
                    className={styles.searchInput}
                    type="text"
                    placeholder="search term (regex supported)"
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            pdfgrep();
                        }
                    }
                    } />
                <button className={styles.searchButton} type="button" disabled={!searchEnabled} onClick={pdfgrep}>search</button>
            </form>

            <ResTable currentRow={currentPdf.resultIndex} data={
                results.map((res, _) => {
                    const [filename, page, ...rest] = res.split(":");
                    const text = rest.join(":");

                    return {
                        filename: filename,
                        page: parseInt(page),
                        text: text
                    }
                })
            } onRowClick={(filename: string, page: number, index: number) => {
                if (!showPdf) {
                    setShowPdf(true);
                }
                if (filename === currentPdf.fileName) {
                    navigationRef.current?.jumpToPage(page - 1);
                    setCurrentPdf(currentPdf => {
                        return {
                            ...currentPdf,
                            resultIndex: index,
                            currentPage: page - 1
                        }
                    });
                } else if (fileNameToData[filename]) {
                    setCurrentPdf({
                        resultIndex: index,
                        fileName: filename,
                        fileData: fileNameToData[filename],
                        currentPage: page - 1
                    });
                }
            }} />
            <PDFViewer initialPage={currentPdf.currentPage} ref={navigationRef} pdfData={currentPdf.fileData} showPdf={(expanded && showPdf) || (!expanded && !headerHidden && showPdf)} expanded={expanded} />
        </>
    )
}
