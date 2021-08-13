import React from 'react';
import ReactDOM from 'react-dom';


import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.js';
import 'bootstrap/dist/js/bootstrap.bundle'
import './index.css';

import { Serial } from './serial.js';

global.jQuery = require('jquery');
require('bootstrap');

const fromHexString = hexString =>
  new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

class Arcade extends React.Component {

    ArcStateConnect = "connect";
    ArcStateConnecting = "connecting";
    ArcStateIdle = "idle";
    ArcStateGame = "game";
    ArcStateOver = "over";

    constructor(props) {
        super(props);
        this.state = {
            player1: 0,
            player2: 0,
            time: 0,
            arcade: this.ArcStateConnect,
        }
    }

    handleConnectClick() {
        this.serial = new Serial();
        this.setState({
            arcade: this.ArcStateConnecting
        });
        this.serial.getDevice().then(() => {
            console.log("Serial connected, updating status.");
            this.setState({
                arcade: this.ArcStateIdle
            });
            this.readSerial();
        }).catch(c => {
            console.log("Catch");
            this.setState({
                arcade: this.ArcStateConnect
            });
        });
    }

    readSerial() {
        var palette = [
            [255, 255, 255],
            [170, 170, 170],
            [85, 85, 85],
            [0, 0, 0],
        ]
        this.serial.read().then(result => {
            console.log("PARSING DATA");
            console.log(result);
            if(!result.startsWith("PRINT ")) {
                setTimeout(() => {
                    this.readSerial();
                }, 80);
                return;
            }
            console.log("IT's a rpint!");
            var hexprint = result.substring(6).replaceAll(" ", "");
            console.log(hexprint);
            var printdata = fromHexString(hexprint);
            console.log(printdata);
            var canvas = document.getElementById('printercanvas');
            var ctx = canvas.getContext('2d');

            var canvasWidth = canvas.width;
            var canvasHeight = canvas.height;
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            var id = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
            var pixels = id.data;

            for(let y = 0; y < 144/8; y++) {
                for (let x = 0; x < 160/8; x++) {
                    const img_x = x * 8;
                    const img_y = y * 8;

                    let idx = ((y * 320) + x * 16);
                    for (let y2=0; y2 < 8; y2++) {
                        let b = y2 * 2;
                        let local_idx = idx + b;
                        for(let i=0; i < 8; i++) {
                            var local_x = img_x + 7 - i;
                            var local_y = img_y + y2;
                            var off = (local_y * id.width + local_x) * 4;
                            var pal_idx = (printdata[local_idx]>>i & 1) | ((printdata[local_idx+1]>>i & 1) << 1);
                            var pal = palette[pal_idx];
                            console.log(pal_idx);
                            pixels[off] = pal[0];
                            pixels[off + 1] = pal[1];
                            pixels[off + 2] = pal[2];
                            pixels[off + 3] = 255;
                        }
                    }
                }
            }

            ctx.putImageData(id, 0, 0);




            setTimeout(() => {
                this.readSerial();
            }, 80);
        });
    }

    render() {
        if (navigator.serial) {
            if (this.state.arcade === this.ArcStateConnect) {
                return (
                    <div className="connect">
                        <button onClick={(e) => this.handleConnectClick()} className="btn btn-lg btn-secondary">Connect</button>
                        <br />
                        <small>Version: 0.1</small>
                    </div>
                )
            } else if (this.state.arcade === this.ArcStateConnecting) {
                return (
                    <div className="connect">
                        <h1>Connecting...</h1>
                    </div>
                )

            } else if (this.state.arcade === this.ArcStateIdle) {
                return (
                    <div className="connect">
                        <div className="container">
                            <h3>Press print on your Game Boy!</h3>
                            <canvas id="printercanvas" width="160px" height="144px">

                            </canvas>
                        </div>
                    </div>)
            }
        } else {
            return (
                <h2>Sorry, your browser does not support Web Serial!</h2>
            )
        }
    }
}

// ========================================

ReactDOM.render(
    <Arcade />,
    document.getElementById('root')
);
