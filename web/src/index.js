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

    palette = [
        [255, 255, 255],
        [170, 170, 170],
        [85, 85, 85],
        [0, 0, 0],
    ];
    margins = {
        top: 0,
        bottom: 0
    };

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
        this.serial.read().then(result => {
            console.log("PARSING DATA");
            console.log(result);
            if(!result.startsWith("PRINT ") && !result.startsWith("PARAMS ")) {
                setTimeout(() => {
                    this.readSerial();
                }, 10);
                return;
            }
            if (result.startsWith("PRINT ")) {
                console.log("IT's a rpint!");
                var hexprint = result.substring(6).replaceAll(" ", "");
                console.log(hexprint);
                var printdata = fromHexString(hexprint);
                console.log(printdata);
                var canvas = document.getElementById('printercanvas');
                var ctx = canvas.getContext('2d');

                // Handle print parameters: palette + margins
                console.log("Palette: %o", this.palette);
                console.log("Margins: %o", this.margins);

                // Resize canvas
                console.log("%d bytes to print...", printdata.length);
                console.log("%d tiles to print...", (printdata.length/16)); // 16 bytes per tile
                var linesCount = ((printdata.length/16)/20);
                console.log("%d lines to print...", linesCount);    // 20 tiles per line
                canvas.height = 8 * ( linesCount + this.margins.top + this.margins.bottom);

                var canvasWidth = canvas.width;
                var canvasHeight = canvas.height;
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                var id = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
                var pixels = id.data;

                var topOffset = this.margins.top * 8 * 160 * 4; // Each margin line is 160 pixels wide and 8 pixels high. Each pixel is 4 bytes.
                console.log("pixel data offset = %d", topOffset);

                for(let y = 0; y < linesCount; y++) {
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
                                var off = topOffset + (local_y * id.width + local_x) * 4;
                                var pal_idx = (printdata[local_idx]>>i & 1) | ((printdata[local_idx+1]>>i & 1) << 1);
                                var pal = this.palette[pal_idx];
                                //console.log(pal_idx);
                                pixels[off] = pal[0];
                                pixels[off + 1] = pal[1];
                                pixels[off + 2] = pal[2];
                                pixels[off + 3] = 255;
                            }
                        }
                    }
                }

                ctx.putImageData(id, 0, 0);
            } else if (result.startsWith("PARAMS ")) {
                console.log("Got print parameters");
                var hexparams = result.substring(7).replaceAll(" ", "");
                console.log(hexparams);
                var paramsdata = fromHexString(hexparams);
                console.log(paramsdata);
                console.log("Margin top: %d", (paramsdata[1]>>4) & 0x0f);
                console.log("Margin bottom: %d", paramsdata[1] & 0x0f);
                console.log("Palette brightest: %d", (paramsdata[2]>>6) & 0x03);
                console.log("Palette bright: %d", (paramsdata[2]>>4) & 0x03);
                console.log("Palette dark: %d", (paramsdata[2]>>2) & 0x03);
                console.log("Palette darkest: %d", paramsdata[2] & 0x03);
                // Update palette and margins
                this.margins.top = (paramsdata[1]>>4) & 0x0f;
                this.margins.bottom = paramsdata[1] & 0x0f;
                var paletteIndexes = [
                    (paramsdata[2]>>6) & 0x03,
                    (paramsdata[2]>>4) & 0x03,
                    (paramsdata[2]>>2) & 0x03,
                    paramsdata[2] & 0x03
                ];
                this.palette = paletteIndexes.map(index => [ index*0x55, index*0x55, index*0x55 ]);
            }




            setTimeout(() => {
                this.readSerial();
            }, 10);
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
