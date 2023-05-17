export default function handler(req, res) {
    const API_KEY = process.env.API_KEY;
    const { id } = req.query;
    fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${id}&key=${API_KEY}`, {
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => response.json()).then(data => {
        let playlistIds = []
        data.items.forEach(item => {
            //add the 'videoId' property of the 'contentDetails' object to the playlistIds array
            playlistIds.push(item.contentDetails.videoId)
        })
        res.status(200).json(playlistIds)
    }).catch(err => {
        console.log(err)
    })
}
