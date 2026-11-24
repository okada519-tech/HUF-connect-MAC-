
enum HUConnectConnector {
    //% block="P0/P14"
    P00P14,
    //% block="P1/P15"
    P01P15,
    //% block="P2/P16"
    P02P16
}

/**
 * Robo Blocksカスタムブロック
 */
//% block="HU connect"
//% color=#4c97fe weight=1 icon="\u21cc" advanced=true
namespace HUConnect {

    const RX_BUFFER_SIZE = 100;
    const START_CHAR = '*';
    const END_CHAR = '\n';

    const POLLING_INTERVAL = 1;

    const GROVE_WIFI_GET_TOKEN_TIMEOUT = 30000;
    const GROVE_WIFI_READ_TIMEOUT = 60000;

    const DO_WORK_INTERVAL = 500;
    const WIFI_CONNECT_TIMEOUT = 30000;

    const SERVER_URI = "wss://blocks.softbankrobotics.com/ws";
    const SERVER_GET_TOKEN_TIMEOUT = 30000;
    const SERVER_MESSAGE_TIMEOUT = 5000;
    const MIN_SEND_VALUE_INTERVAL = 1000;

    ////////////////////////////////////////////////////////////////////////////////
    // Helper functions

    function StringIndexOf(str: string, key: string, index: number): number {
        if (index == 0) {
            return str.indexOf(key);
        }
        else {
            let i = str.substr(index, str.length).indexOf(key);
            if (i >= 0) i += index;
            return i;
        }
    }

    function StringReplace(str: string, fromStr: string, toStr: string): string {
        let i = 0;
        while ((i = StringIndexOf(str, fromStr, i)) >= 0) {
            str = str.substr(0, i) + toStr + str.substr(i + fromStr.length, str.length);
            i += toStr.length;
        }
        return str;
    }

    function ItemEncode(str: string): string {
        let str2 = "";

        for (let i = 0; i < str.length; i++) {
            if (str[i] === '\\') str2 += "\\\\";
            else if (str[i] === '*') str2 += "\\s";
            else if (str[i] === '\n') str2 += "\\n";
            else if (str[i] === ',') str2 += "\\c";
            else str2 += str[i];
        }

        return str2;
    }

    function ItemDecode(str: string): string {
        let str2 = "";

        for (let i = 0; i < str.length; i++) {
            if (str[i] === '\\') {
                if (++i >= str.length) break;
                if (str[i] === '\\') str2 += '\\';
                else if (str[i] === 's') str2 += '*';
                else if (str[i] === 'n') str2 += '\n';
                else if (str[i] === 'c') str2 += ',';
            }
            else {
                str2 += str[i];
            }
        }

        return str2;
    }

    function ParseServerMessage(str: string): { [key: string]: string; } {
        let message: { [key: string]: string; } = {};

        let lines = str.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let items = lines[i].split('\t');
            if (items.length === 2) {
                message[items[0]] = items[1];
            }
        }

        return message;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // SerialInterface

    namespace SerialInterface {

        let AttachedDataReceived = false;
        let ReceivedData: string[] = undefined;

        function DataReceived(): void {
            let str = serial.readUntil(serial.delimiters(Delimiters.NewLine));

            let startIndex = StringIndexOf(str, START_CHAR, 0);
            if (startIndex < 0) return;
            {
                let i: number;
                while ((i = StringIndexOf(str, START_CHAR, startIndex + 1)) >= 0) {
                    startIndex = i;
                }
            }
            str = str.substr(startIndex + 1, str.length);
            if (str.length >= 1) {
                if (str.charAt(str.length - 1) === END_CHAR) {
                    str = str.substr(0, str.length - 1);
                }
            }

            // Debug print
            //serial.writeString(str);

            if (ReceivedData !== undefined) return;
            ReceivedData = str.split(',');
            for (let i = 0; i < ReceivedData.length; i++) {
                ReceivedData[i] = ItemDecode(ReceivedData[i]);
            }
        }

        export function Write(items: string[]): void {
            for (let i = 0; i < items.length; i++) {
                items[i] = ItemEncode(items[i]);
            }
            serial.writeString(START_CHAR + items.join(',') + END_CHAR);
        }

        export function PreRead(): void {
            if (!AttachedDataReceived) {
                serial.onDataReceived(serial.delimiters(Delimiters.NewLine), DataReceived);
                AttachedDataReceived = true;
            }

            ReceivedData = undefined;
        }

        export function Read(): string[] {
            let startTime = input.runningTime();
            while (ReceivedData === undefined) {
                if (input.runningTime() >= startTime + GROVE_WIFI_READ_TIMEOUT) control.panic(102);
                basic.pause(POLLING_INTERVAL);
            }

            return ReceivedData;
        }

    }

    ////////////////////////////////////////////////////////////////////////////////
    // GroveWiFi

    namespace GroveWiFi {

        let Token = true;

        function GetToken(): void {
            let startTime = input.runningTime();
            while (!Token) {
                if (input.runningTime() >= startTime + GROVE_WIFI_GET_TOKEN_TIMEOUT) control.panic(101);
                basic.pause(POLLING_INTERVAL);
            }

            Token = false;
        }

        function ReturnToken(): void {
            Token = true;
        }

        /**
         * Send a firmware command and return its raw response.
         */
        export function WiFiModuleCommand(command: string): string {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write([command]);
            let res = SerialInterface.Read();
            ReturnToken();
            return res.join("|");
        }

        export function WiFiStatus(): number {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["wifi_status"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 2) control.panic(0);
            if (res[0] !== "ok") control.panic(1);

            return parseInt(res[1]);
        }

        export function WiFiConnect(ssid: string, password: string): void {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["wifi_connect", ssid, password]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 1) control.panic(2);
            if (res[0] !== "ok") control.panic(3);
        }

        export function WiFiDisconnect(): void {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["wifi_disconnect"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 1) control.panic(4);
            if (res[0] !== "ok") control.panic(5);
        }

        export function WiFiIsConnected(): boolean {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["wifi_isconnected"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 2) control.panic(6);
            if (res[0] !== "ok") control.panic(7);

            return res[1] !== "0";
        }

        export function WsSecurity(): void {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_security", "insecure"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 1) control.panic(8);
            if (res[0] !== "ok") control.panic(9);
        }

        export function WsConnect(url: string): boolean {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_connect", url]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 1) control.panic(10);
            if (res[0] === "connect_error") {
                return false;
            }
            if (res[0] !== "ok") control.panic(11);

            return true;
        }

        // Diagnostic helper
        export function WsDiagnostic(url: string): string {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_connect", url]);
            let res = SerialInterface.Read();
            ReturnToken();
            return res.join("|");
        }

        export function WsClose(): void {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_close"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 1) control.panic(12);
            if (res[0] !== "ok") control.panic(13);
        }

        export function WsSend(str: string): void {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_send", str.length.toString(), str]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 1) control.panic(14);
            if (res[0] !== "ok") control.panic(15);
        }

        export function WsReceivedCount(): number {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_receivedcount"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length !== 2) control.panic(16);
            if (res[0] !== "ok") control.panic(17);

            return parseInt(res[1]);
        }

        export function WsReceive(): string {
            GetToken();
            SerialInterface.PreRead();
            SerialInterface.Write(["ws_receive"]);
            let res = SerialInterface.Read();
            ReturnToken();

            if (res.length < 1) control.panic(18);
            if (res[0] === "not_received") return undefined;
            if (res[0] !== "ok") control.panic(19);
            if (res.length !== 3) control.panic(20);

            return res[2];
        }

    }

    ////////////////////////////////////////////////////////////////////////////////
    // Wi-Fi event handlers and connection state

    let wifiConnectedHandler: () => void;
    let wifiFailedHandler: () => void;
    let wifiDisconnectedHandler: () => void;
    let wifiMonitorStarted = false;
    let wifiWasConnected = false;
    let wifiConnecting = false;
    let wifiConnectStartedAt = 0;

    // Custom WebSocket event handlers and connection state
    let customWebSocketConnectedHandler: () => void;
    let customWebSocketDisconnectedHandler: () => void;
    let customWebSocketIsConnected = false;

    function startWiFiMonitor(): void {
        if (wifiMonitorStarted) return;
        wifiMonitorStarted = true;
        control.inBackground(() => {
            while (true) {
                let connected = GroveWiFi.WiFiIsConnected();
                if (connected && !wifiWasConnected) {
                    wifiWasConnected = true;
                    wifiConnecting = false;
                    if (wifiConnectedHandler) wifiConnectedHandler();
                } else if (!connected && wifiWasConnected) {
                    wifiWasConnected = false;
                    if (wifiDisconnectedHandler) wifiDisconnectedHandler();
                } else if (!connected && wifiConnecting && input.runningTime() - wifiConnectStartedAt >= WIFI_CONNECT_TIMEOUT) {
                    wifiConnecting = false;
                    if (wifiFailedHandler) wifiFailedHandler();
                }
                basic.pause(500);
            }
        });
    }

    /** Select the Grove Shield UART pins for Grove UART WiFi V2. */
    //% blockId=HUConnect_WiringGroveWiFi
    //% block="[Grove - UART WiFi V2] communication port|%connector"
    //% weight=100
    export function WiringGroveWiFi(connector: HUConnectConnector): void {
        switch (connector) {
            case HUConnectConnector.P00P14:
                serial.redirect(SerialPin.P14, SerialPin.P0, BaudRate.BaudRate9600);
                break;
            case HUConnectConnector.P01P15:
                serial.redirect(SerialPin.P15, SerialPin.P1, BaudRate.BaudRate9600);
                break;
            case HUConnectConnector.P02P16:
                serial.redirect(SerialPin.P16, SerialPin.P2, BaudRate.BaudRate9600);
                break;
        }
        serial.setRxBufferSize(RX_BUFFER_SIZE);
        startWiFiMonitor();
    }

    /** Send a diagnostic command and return the Wi-Fi module response as text. */
    //% blockId=HUConnect_WiFiModuleCommand
    //% block="Wi-Fiモジュールに問い合わせる コマンド %command"
    //% command.defl="wifi_mac"
    //% weight=76
    export function WiFiModuleCommand(command: string): string {
        return GroveWiFi.WiFiModuleCommand(command);
    }

    /** Connect to a Wi-Fi access point. */
    //% blockId=HUConnect_ConnectWiFi
    //% block="connect to Wi-Fi|SSID %ssid|password %password"
    //% weight=90
    export function ConnectWiFi(ssid: string, password: string): void {
        wifiConnecting = true;
        wifiConnectStartedAt = input.runningTime();
        GroveWiFi.WiFiConnect(ssid, password);
    }

    /** Run code when Wi-Fi connection is detected. */
    //% blockId=HUConnect_ConnectedWiFiSuccess
    //% block="on Wi-Fi connected"
    //% weight=80
    export function ConnectedWiFiSuccess(handler: () => void): void {
        wifiConnectedHandler = handler;
    }

    /** Run code when Wi-Fi connection fails. */
    //% blockId=HUConnect_ConnectedWiFiFail
    //% block="on Wi-Fi connection failed"
    //% weight=79
    export function ConnectedWiFiFail(handler: () => void): void {
        wifiFailedHandler = handler;
    }

    /** Run code when Wi-Fi is disconnected. */
    //% blockId=HUConnect_DisconnectedWiFiSuccess
    //% block="on Wi-Fi disconnected"
    //% weight=78
    export function DisconnectedWiFiSuccess(handler: () => void): void {
        wifiDisconnectedHandler = handler;
    }

    /** Connect to a custom WebSocket server. */
    //% blockId=HUConnect_ConnectCustomWebSocket
    //% block="カスタムWebSocketに接続 URL %url"
    //% url.defl="ws://172.20.10.5:8765"
    //% weight=70
    export function ConnectCustomWebSocket(url: string): void {
        customWebSocketIsConnected = false;

        GroveWiFi.WsSecurity();

        if (GroveWiFi.WsConnect(url)) {
            customWebSocketIsConnected = true;

            if (customWebSocketConnectedHandler) {
                customWebSocketConnectedHandler();
            }
        }
    }

    /** Run code when custom WebSocket connection succeeds. */
    //% blockId=HUConnect_ConnectedCustomWebSocketSuccess
    //% block="カスタムWebSocketに接続が成功したとき"
    //% weight=69
    export function ConnectedCustomWebSocketSuccess(handler: () => void): void {
        customWebSocketConnectedHandler = handler;
    }

    /** Send a text message over the established WebSocket connection. */
    //% blockId=HUConnect_SendCustomWebSocketMessage
    //% block="WebSocketでメッセージを送信 %message"
    //% weight=60
    export function SendCustomWebSocketMessage(message: string): void {
        GroveWiFi.WsSend(message);
    }

    /** Send a numeric value over the established WebSocket connection. */
    //% blockId=HUConnect_SendCustomWebSocketNumber
    //% block="WebSocketで数値を送信 %value"
    //% value.defl=23.6
    //% weight=55
    export function SendCustomWebSocketNumber(value: number): void {
        GroveWiFi.WsSend(value.toString());
    }

    /** Return the raw response from a WebSocket connection attempt. */
    //% blockId=HUConnect_CustomWebSocketDiagnostic
    //% block="get custom WebSocket response for URL %url"
    //% url.defl="ws://172.20.10.5:8765"
    //% weight=50
    export function CustomWebSocketDiagnostic(url: string): string {
        GroveWiFi.WsSecurity();
        return GroveWiFi.WsDiagnostic(url);
    }

    /** Close the current WebSocket connection. */
    //% blockId=HUConnect_DisconnectCustomWebSocket
    //% block="カスタムWebSocketを切断"
    //% weight=40
    export function DisconnectCustomWebSocket(): void {
        GroveWiFi.WsClose();

        if (customWebSocketIsConnected) {
            customWebSocketIsConnected = false;

            if (customWebSocketDisconnectedHandler) {
                customWebSocketDisconnectedHandler();
            }
        }
    }

    /** Run code when custom WebSocket is disconnected. */
    //% blockId=HUConnect_DisconnectedCustomWebSocket
    //% block="カスタムWebSocketが切断されたとき"
    //% weight=39
    export function DisconnectedCustomWebSocket(handler: () => void): void {
        customWebSocketDisconnectedHandler = handler;
    }

}
