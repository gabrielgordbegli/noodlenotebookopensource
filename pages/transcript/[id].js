import { React, useState, useEffect } from 'react'
import styles from '../../styles/Transcript.module.css'

//duration is in milliseconds

function transcript(res, req) {

    let [notebookID, setNotebookID] = useState('')

    //when the page loads set the notebookID to req.query.id
    useEffect(() => {
        setNotebookID(res.id)
    }, [])

    //when the notebookID changes 

    
    //when the page loads, if the id is not null then fetch the transcript
    useEffect(() => {
        if (notebookID) {
            setPlaylistId(id)
            click()
        }
    }, [])

    let [playlistId, setPlaylistId] = useState('')
    let [videoIds, setVideoIds] = useState([])
    let [transcripts, setTranscripts] = useState([])
    let [showPdf, setShowPdf] = useState(false)

    //if the '\' key is pressed then toggle the showPdf state
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === '\\') {
                setShowPdf(!showPdf)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [showPdf])


    useEffect(() => {
        for (let i = 0; i < videoIds.length; i++) {
            fetch(`/api/video/${videoIds[i]}`)
                .then(response => response.json())
                .then(data => {
                    setTranscripts(transcripts => [...transcripts, data])
                })
        }
    }, [videoIds])

    function filter_playlistId(url) {
        var playlistId = url.split("list=")[1];
        return playlistId;
    }

    function click() {
        fetch(`/api/playlist/${playlistId}`)
            .then(response => response.json())
            .then(data => {
                setVideoIds(data)
            })
    }

    return (
        <>
            <div className={styles.container}>

                <div className={styles['header']}>
                    <input className={styles['url']} type="text" placeholder='paste youtube playlist url here' onChange={(e) => setPlaylistId(filter_playlistId(e.target.value))} />
                    <button onClick={click}>Get Transcripts</button>
                    <button onClick={() => setShowPdf(!showPdf)}>Toggle Pdf Search</button>
                </div>
                <div className={styles['pdf-container']}>
                    {showPdf ? <iframe src="https://nnstopgap.vercel.app/" width="100%" height="100%" /> : null}
                </div>
                {!showPdf ?
                    <div className={styles['body']}>
                        <div className={styles['transcripts']}>
                            <ul>
                                {
                                    transcripts.map((transcript, indexVideo) => {
                                        return (
                                            <>
                                                {
                                                    transcript.transcript.map((timestamp, indexText) => {
                                                        return (
                                                            <>
                                                                {/* <li><a className={styles['link']} target="_blank" href={`https://youtube.com/watch?v=${transcript.id}&t=${Math.floor(timestamp.offset / 1000)}s`}>{timestamp.text}</a></li> */}
                                                                <li className={styles['list-item']}><a className={styles['link']} target="myIframe" href={`https://www.youtube.com/embed/${transcript.id}?start=${Math.floor(timestamp.offset / 1000)}&autoplay=1&modestbranding=1`}>{timestamp.text} </a></li>
                                                            </>
                                                        )
                                                    })
                                                }
                                            </>
                                        )
                                    })}
                            </ul>
                        </div>
                        <div className={styles['embed']}>
                            <iframe name="myIframe" width="100%" height="100%" src="https://www.youtube-nocookie.com/embed/nQ9bszUxOEI?start=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        </div>
                    </div>
                    : null}

            </div>


        </>
    )
}

export default transcript