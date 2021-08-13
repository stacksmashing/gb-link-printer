// import readline from 'readline';

class Serial {
    constructor() {
        this.leftover = "";
    }

    static requestPort() {
        return navigator.serial.requestPort().then(
            device => {
                return device;
            }
        );
        
    }
    getDevice() {
        let device = null;
        this.ready = false;
        return new Promise((resolve, reject) => {
            Serial.requestPort().then(dev => {
                console.log("Opening device...");
                device = dev;
                this.device = device;
                return this.device.open({baudRate: 115200});
            }).then(() => {
                console.log("Open!");
                this.ready = true;
                console.log(this.device);
                this.reader = this.device.readable.getReader();
                resolve();
            });
        });
    }

    tryLeftover(resolve) {
        var idx = this.leftover.indexOf("\r\n");
        if(idx === -1) {
            this.doRead(resolve);
            return;
        }

        var returnstring = this.leftover.substring(0, idx);
        this.leftover = this.leftover.substring(idx+2);

    
        // else...
        console.log("Returning: " + returnstring);
        console.log("leftover: " + this.leftover);
        resolve(returnstring);
    }

    doRead(resolve) {
        this.reader.read().then(({done, value}) => {
            
            var received_string = new TextDecoder().decode(value);
            this.leftover += received_string;
            this.tryLeftover(resolve);
        });
    };

    read() {
        return new Promise((resolve, reject) => {
            this.tryLeftover(resolve);
        }); 
    }
}

export { Serial };
