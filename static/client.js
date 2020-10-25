let ws = new WebSocket('ws://' + window.location.host);
let videoIn = document.querySelector('#src-vid');
let videoOut = document.querySelector('#peer-vid');
let webRtcPeer = null;
const id = Math.random().toString(36).substr(2,9);
const room = 'test';

function recv(e) {
    try {
        let msg = JSON.parse(e.data);
        switch (msg.type) {
        case 'ack':
            // Acknowledge request
            console.log(`[+] Client is ${msg.role}`);;
            break;
        case 'candidate':
            // Add ICE candidate
            console.log('[+] Received ICE candidates');
            webRtcPeer.addIceCandidate(msg.candidate);
            break;
        case 'answer':
            // Respond to answer
            console.log('[+] Received answer');
            webRtcPeer.processAnswer(msg.sdp);
            break;
        default:
            console.error('[!] Unknown type: ', msg.type);
        }
    } catch(e) {
        console.error(`[!] Parsing error: ${e}`);
    }
}

function call() {
    console.log('[+] Starting call...');

    const options = {
        localVideo: videoIn,
        remoteVideo: videoOut,
        onicecandidate: candidate
    }
    
    webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, err => {
        if (err) console.error(`[!] Error initializing client: ${err}`);

        console.log('[+] Generating offer');
        webRtcPeer.generateOffer((err, sdp) => {
            const data = {
                id: id,
                type: 'open',
                room: room,
                sdp: sdp
            }
            ws.send(JSON.stringify(data));
        });
    })
}

function candidate(candidate) {
    console.log('[+] Sending ICE candidate...');
    const data = {
        id: id,
        type: 'candidate',
        room: room,
        candidate: candidate
    }
    ws.send(JSON.stringify(data));
}

ws.onmessage = recv;
ws.onopen = () => {
    call();
}
window.onbeforeunload = () => {
    const data = {
        type: 'close',
        room: room
    }
    ws.send(JSON.stringify(data));
    ws.close();
}