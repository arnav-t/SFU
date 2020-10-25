const ws = require('ws');
const kurento = require('kurento-client');
const kms_uri = 'ws://kms:8888/kurento';

class App {
    constructor(server) {
        this.wss = new ws.Server({ server });

        // Listen for ws client connections
        this.wss.on('connection', (sock, req) => {
            sock.on('message', msg => this.message(sock, msg));
        });

        // Initialize kurento client
        kurento(kms_uri) 
            .then(kurentoClient => this.kurentoClient = kurentoClient)
            .catch(err => console.error(`[!] Failed to initialize kurento client: ${err}`));

        // Track connections
        this.rooms = {};
        this.conns = {};
    }

    message(sock, msg) {
        try {
            const data = JSON.parse(msg);
            switch(data.type) {
            case 'open':
                this.open(sock, data.room, data.sdp, data.id);
                break;
            case 'close':
                this.close(data.room);
                break;
            case 'candidate':
                if (data.id in this.conns) {
                    if ('endpoint' in this.conns[data.id]) {
                        this.conns[data.id].endpoint.addIceCandidate(data.candidate);
                    } else {
                        this.conns[data.id].candidates.push(data.candidate);
                    }
                } else console.log('[!] Connection not initialized');
                break;
            default:
                console.error(`[!] Unknown message: ${msg.type}`);
            }
        } catch (err) {
            console.error(`[!] Error parsing message: ${err}`);
        }
    }

    close(room) {
        console.log(`[-] Tearing down room ${room}`);
        const caller = this.rooms[room].caller;
        const callee = this.rooms[room].callee;
        delete this.conns[caller];
        delete this.conns[callee];
        delete this.rooms[room];
    }

    open(sock, room, sdp, id) {
        if (!(room in this.rooms) || !('caller' in this.rooms[room])) {
            // Store connection
            this.conns[id] = {
                room: room,
                role: 'caller',
                ws: sock,
                sdp: sdp,
                candidates: []
            }
            this.rooms[room] = {
                caller: id
            }

            // Send acknowledgement
            const ackdata = {
                type: 'ack', 
                role: 'caller'
            }
            sock.send(JSON.stringify(ackdata));

            // Create media pipeline
            this.kurentoClient.create('MediaPipeline')
                .then(pipeline => {
                    console.log(`[+] Created pipeline for ${room}`);
                    this.rooms[room].pipeline = pipeline;
                    this.conns[id].pipeline = pipeline;
                    return pipeline.create('WebRtcEndpoint');
                })
                .then(callerEndpoint => {
                    console.log(`[+] Created caller endpoint for ${room}`);
                    this.conns[id].endpoint = callerEndpoint;
                    callerEndpoint.on('OnIceCandidate', e => {
                        console.log(`[+] Received caller ICE candidates ${room}`);
                        const candidate = kurento.getComplexType('IceCandidate')(e.candidate);
                        const data = {
                            type: 'candidate',
                            candidate: candidate
                        }
                        this.conns[id].ws.send(JSON.stringify(data));
                    });

                    for (let ice of this.conns[id].candidates) {
                        callerEndpoint.addIceCandidate(ice);
                    }
                    this.conns[id].candidates = [];

                    this.generateAnswer(id);
                })
                .catch(err => console.error(`[!] Failed to create pipeline: ${err}`));
        } else {
            // Store connection
            this.conns[id] = {
                room: room,
                role: 'callee',
                ws: sock,
                sdp: sdp,
                candidates: []
            }
            this.rooms[room].callee = id;

            // Send acknowledgement
            const ackdata = {
                type: 'ack', 
                role: 'callee'
            }
            sock.send(JSON.stringify(ackdata));

            let pipeline = this.rooms[room].pipeline;
            pipeline.create('WebRtcEndpoint')
                .then(calleeEndpoint => {
                    console.log(`[+] Created callee endpoint for ${room}`);
                    this.conns[id].endpoint = calleeEndpoint;
                    calleeEndpoint.on('OnIceCandidate', e => {
                        console.log(`[+] Received callee ICE candidates ${room}`);
                        const candidate = kurento.getComplexType('IceCandidate')(e.candidate);
                        const data = {
                            type: 'candidate',
                            candidate: candidate
                        }
                        this.conns[id].ws.send(JSON.stringify(data));
                    });

                    for (let ice of this.conns[id].candidates) {
                        calleeEndpoint.addIceCandidate(ice);
                    }
                    this.conns[id].candidates = [];

                    this.generateAnswer(id);

                    const callerId = this.rooms[room].caller;
                    const calleeId = this.rooms[room].callee;
                    // Connect endpoints
                    this.conns[callerId].endpoint.connect(this.conns[calleeId].endpoint, err => {
                        if (err) console.log(`[!] Failed to connect endpoints: ${err}`);
                    });
                    this.conns[calleeId].endpoint.connect(this.conns[callerId].endpoint, err => {
                        if (err) console.log(`[!] Failed to connect endpoints: ${err}`);
                    });
                });
        }
    }

    async generateAnswer(id) {
        let webRtcEndpoint = this.conns[id].endpoint;
        const answer = await webRtcEndpoint.processOffer(this.conns[id].sdp);
        webRtcEndpoint.gatherCandidates(err => {
            if (err) console.error(`[!] Failed to gather candidates: ${err}`);
        });
        const data = {
            type: 'answer',
            sdp: answer
        }
        this.conns[id].ws.send(JSON.stringify(data));
    }
}

module.exports = App;