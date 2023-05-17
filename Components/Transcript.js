import { React, useState, useEffect } from 'react'
import styles from '../styles/Transcript.module.css'

//duration is in milliseconds

function Transcript(res, req) {


    let [playlistId, setPlaylistId] = useState(res.playlistId)
    let [videoIds, setVideoIds] = useState([])
    let [transcripts, setTranscripts] = useState([])

    useEffect(() => {
        if (playlistId) {
            fetch(`/api/playlist/${playlistId}`)
                .then(response => response.json())
                .then(data => {
                    setVideoIds(data)
                })
        }
    }, [playlistId])

    useEffect(() => {
        for (let i = 0; i < videoIds.length; i++) {
            fetch(`/api/video/${videoIds[i]}`)
                .then(response => response.json())
                .then(data => {
                    setTranscripts(transcripts => [...transcripts, data])
                })
        }
    }, [videoIds])

    return (
        <>
            <div className={styles['transcripts']}>
                <div className={styles['child']}>
                    <ul>
                        {
                            transcripts.map((transcript, indexVideo) => {
                                return (
                                    <>
                                        {
                                            transcript.transcript.map((timestamp, indexText) => {
                                                return (
                                                    <>
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
            </div>
            <div className={styles['embed']}>
                <iframe name="myIframe" width="100%" height="100%" src="https://www.youtube-nocookie.com/embed/nQ9bszUxOEI?start=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        </>
    )
}

export default Transcript