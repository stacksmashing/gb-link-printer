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

class PaletteSelector extends React.Component {

    arraySat = [3,10,17,22,29,37,43,47,54,61,67,75,82,83,88,100];
    arrayBr = [98,94,87,81,76,70,64,57,51,44,38,32,25,19,13,6];

    constructor(props) {
        super(props);
        var initHue = 180;
        const storedHue = localStorage.getItem('paletteSelector.hue');
        if (storedHue !== null) {
            console.log('Initializing hue with stored value: %d', parseInt(storedHue));
            initHue = parseInt(storedHue);
        }
        var initShift = 0;
        const storedShift = localStorage.getItem('paletteSelector.shift');
        if (storedShift !== null) {
            console.log('Initializing shift with stored value: %d', parseInt(storedShift));
            initShift = parseInt(storedShift);
        }
        var initExpression = 0;
        const storedExpression = localStorage.getItem('paletteSelector.expression');
        if (storedExpression !== null) {
            console.log('Initializing expression with stored value: %d', parseInt(storedExpression));
            initExpression = parseInt(storedExpression);
        }
        this.state = {
            hue: initHue,
            shift: initShift,
            expression: initExpression,
            arrayColor4: []
        };
    }

    componentDidMount() {
        this.recalculate();
    }

    handleHueChange(e) {
        const newHue = parseInt(e.target.value);
        localStorage.setItem('paletteSelector.hue', newHue);
        this.setState({hue: newHue}, this.recalculate);
    }

    handleShiftChange(e) {
        const newShift = parseInt(e.target.value);
        localStorage.setItem('paletteSelector.shift', newShift);
        this.setState({shift: newShift}, this.recalculate);
    }

    handleExpressionChange(e) {
        const newExpression = parseInt(e.target.value);
        localStorage.setItem('paletteSelector.expression', newExpression);
        this.setState({expression: newExpression}, this.recalculate);
    }

    getHue(i) {
        return Math.abs(i%360);
    }

    hsv2rgb(hue, sat, val) {
        var red, grn, blu, i, f, p, q, t;
        hue %= 360;
        if (val === 0) {
        return ({ r: 0, g: 0, b: 0 });
        }
        if (sat > 100) sat = 100;
        if (sat < 0) sat = 0;
        if (val > 100) val = 100;
        if (val < 0) val = 0;
        sat /= 100;
        val /= 100;
        hue /= 60;
        i = Math.floor(hue);
        f = hue - i;
        p = val * (1 - sat);
        q = val * (1 - (sat * f));
        t = val * (1 - (sat * (1 - f)));
        if (i === 0) {
        red = val; grn = t; blu = p;
        } 
        else if (i === 1) {
        red = q; grn = val; blu = p;
        } 
        else if (i === 2) {
        red = p; grn = val; blu = t;
        } 
        else if (i === 3) {
        red = p; grn = q; blu = val;
        } 
        else if (i === 4) {
        red = t; grn = p; blu = val;
        } 
        else if (i === 5) {
        red = val; grn = p; blu = q;
        }
        red = Math.floor(red * 255);
        grn = Math.floor(grn * 255);
        blu = Math.floor(blu * 255);
        return {
        r: red, g: grn, b: blu
        };
    }

    recalculate() {
        var arrayColor16 = [];
        for ( var i=0; i<16; i++ ) {
            var h = this.getHue( this.state.hue - this.state.shift*(i-8) );
            var shift = (8-Math.abs(i-7))*this.state.expression/5;
            arrayColor16[i] = this.hsv2rgb( h, this.arraySat[i] + shift, this.arrayBr[i] + shift );
        }

        // and 4 shaded ramp color array
        var arrayColor4 = [ arrayColor16[1], arrayColor16[5], arrayColor16[10], arrayColor16[14] ];
        this.setState({ arrayColor4: arrayColor4 }, () => this.props.onChange(this.state.arrayColor4))
    }

    render() {
        return (<div className="palette-selector">
            <h4>Custom palette settings:</h4>
            
            <div>
                <input type="range" id="hue" name="hue" min="0" max="360" value={this.state.hue} onChange={(e) => this.handleHueChange(e)} />
                <label htmlFor="hue">Hue ({this.state.hue})</label>
            </div>
            <div>
                <input type="range" id="shift" name="shift" min="0" max="50" value={this.state.shift} onChange={(e) => this.handleShiftChange(e)} />
                <label htmlFor="shift">Hue Shift ({this.state.shift})</label>
            </div>
            <div>
                <input type="range" id="expression" name="expression" min="-50" max="50" value={this.state.expression} onChange={(e) => this.handleExpressionChange(e)} />
                <label htmlFor="expression">Hue Expression ({this.state.expression})</label>
            </div>

            <p className="palette-credits">Custom palette powered by <a href="http://4bytes.art/crc.html">Color Ramp Creator</a> / <a href="https://4bytes.art/">@kaytrance</a></p>
        </div>)
    }

}

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

    constructor(props) {
        super(props);
        var initUseCustomPalette = false;
        const storedUseCustomPalette = localStorage.getItem('arcade.useCustomPalette');
        if (storedUseCustomPalette !== null) {
            console.log('Initializing useCustomPalette with stored value: %o', JSON.parse(storedUseCustomPalette));
            initUseCustomPalette = JSON.parse(storedUseCustomPalette);
        }
        this.state = {
            player1: 0,
            player2: 0,
            time: 0,
            arcade: this.ArcStateConnect,
            printdata: null,
            linesCount: 0,
            customPalette: null,
            useCustomPalette: initUseCustomPalette
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

    handlePaletteChange(palette) {
        this.setState({customPalette: palette.map(color => [color.r, color.g, color.b])});
    }

    handleCustomPaletteChange(e) {
        const newUseCustomPalette = e.target.checked;
        localStorage.setItem('arcade.useCustomPalette', newUseCustomPalette);
        this.setState({useCustomPalette: newUseCustomPalette});
    }

    handleCanvasRef(ref) {
        this.canvasRef = ref;
    }

    readSerial() {
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
            // Trigger render
            this.setState({
                printdata: printdata,
                linesCount: ((printdata.length/16)/20)
            });



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
                var actualPalette = this.state.useCustomPalette ? this.state.customPalette : this.palette;
                var canvas = this.canvasRef;
                if (canvas && this.state.printdata && this.state.linesCount > 0) {
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
                                    var pal_idx = (this.state.printdata[local_idx]>>i & 1) | ((this.state.printdata[local_idx+1]>>i & 1) << 1);
                                    var pal = actualPalette[pal_idx];
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
                }
                return (
                    <div className="connect">
                        <div className="container">
                            <h3>Press print on your Game Boy!</h3>
                            <canvas ref={(ref) => this.handleCanvasRef(ref)} id="printercanvas" width="160px" height="144px">

                            </canvas>

                            {/* Switch between default and custom palette */}
                            <div className="custom-control custom-switch">
                                <input className="custom-control-input" type="checkbox" id="customPaletteSwitch" name="customPaletteSwitch" checked={this.state.useCustomPalette} onChange={(e) => this.handleCustomPaletteChange(e)} />
                                <label className="custom-control-label" htmlFor="customPaletteSwitch">Use custom palette</label>
                            </div>

                            {/* Display palette being used for rendering (either default or custom) */}
                            {actualPalette && 
                                <div className="palette-preview">
                                    {actualPalette.map((color,idx) => <div key={`palette-rendering-${idx}`} className="palette-color" style={{ backgroundColor: `rgb(${color[0]},${color[1]},${color[2]})`}}><span>({color[0]}, {color[1]}, {color[2]})</span></div>)}
                                </div>
                            }

                            {/* Custom palette selector */}
                            <PaletteSelector onChange={(p) => this.handlePaletteChange(p)}></PaletteSelector>
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
