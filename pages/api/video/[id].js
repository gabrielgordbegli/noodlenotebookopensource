import YoutubeTranscript from 'youtube-transcript';
export default function handler(req, res) {
    const { id } = req.query;

    YoutubeTranscript.fetchTranscript(`${id}`).then(
        transcript => {
            let transcriptObject = {
                id: id,
                transcript: transcript
            }
            res.status(200).json(transcriptObject)
        }
    )
}