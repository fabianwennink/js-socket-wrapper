'use strict';

const WebSocket = require('ws');

const RECONNECT_DELAY = 5000;

class WebSocketWrapper {

    // _url ~ Holds the server URL.
    // _socket ~ Holds the WebSocket object.
    // _callbacks ~ Holds the callbacks.
    // _canReconnect ~ If the WebSocketWrapper should try to reconnect automatically.
    // _isServer ~ If the WebSocketWrapper instance is a Server or Client.

    /**
     * Initiate the socket connection as a client.
     * @param host The host address of the server to connect to.
     * @param port The port of the server to connect to.
     * @param secure If the connection should be encrypted or not.
     * @param reconnect If any attempt should be made to automatically reconnect to the server.
     * @returns {WebSocketWrapper} A new instance of the WebSocketWrapper.
     */
    client(host, port = '', secure = true, reconnect = true) {
        const protocolSocket = (!secure) ? 'ws' : 'wss';
        this._url = (port) ? `${protocolSocket}://${host}:${port}` : `${protocolSocket}://${host}`;
        this._socket = new WebSocket(this._url);
        this._callbacks = [];
        this._canReconnect = reconnect;
        this._isServer = false;

        // In case the server disconnects, try to reconnect.
        if(reconnect) {
            this.onDisconnect(() => {
                this._attemptReconnecting();
            });
        }

        return this;
    }

    /**
     * Initiate the socket connection as a server.
     * @param server The external server.
     * @returns {WebSocketWrapper} A new instance of the WebSocketWrapper.
     */
    server(server) {
        this._socket = new WebSocket.Server({ server });
        this._callbacks = [];
        this._canReconnect = false;
        this._isServer = true;
        return this;
    }

    /**
     * Bind a callback to the Message event of the socket server.
     * @param {Function} callback The event callback.
     */
    onMessage(callback) {
        return this._onEvent(SocketEvent.MESSAGE, callback);
    }

    /**
     * Bind a callback to the Connection/Open event of the socket server.
     * @param {Function} callback The event callback.
     */
    onConnect(callback) {
        if(this._isServer) {
            this._onEvent(SocketEvent.CONNECTION, callback);
        } else {
            this._onEvent(SocketEvent.OPEN, callback);
        }
    }

    /**
     * Bind a callback to the Close event of the socket server.
     * @param {Function} callback The event callback.
     */
    onDisconnect(callback) {
        this._onEvent(SocketEvent.CLOSE, callback);
    }

    /**
     * Bind a callback to the Error event of the socket server.
     * @param {Function} callback The event callback.
     */
    onError(callback) {
        this._onEvent(SocketEvent.ERROR, callback);
    }

    /**
     * Send a socket message to the websocket server.
     * @param content The content to send to the server.
     */
    sendMessage(content) {
        this._socket.send(content);
    }

    /**
     * Unsubscribe a callback from a certain socket event.
     * @param {SocketEvent} eventType The socket event type to unsubscribe the callback from.
     * @param {Function} callback The event callback.
     */
    unsubscribe(eventType, callback) {

        // Remove from the callbacks array
        const index = this._callbacks.findIndex((cb) => cb.event === eventType && cb.callback === callback);
        if(index > 0) {
            const registeredCallback = this._callbacks[index].callback;

            // Remove the event listener for the specific event
            this._socket.removeEventListener(eventType, registeredCallback);
            this._callbacks.splice(index, 1);
        }
    }

    /**
     * Internally used to register events with callbacks to the websocket.
     * The callback will be stored in cache for later reference.
     * @param {SocketEvent} eventType The socket event type being bound.
     * @param {Function} callback The event callback.
     * @private
     */
    _onEvent(eventType, callback) {
        this._socket.on(eventType, callback);

        // Push the callback into the cache.
        // Used during reconnects and unsubscribe events.
        this._callbacks.push({
            event: eventType,
            callback
        });
    }

    /**
     * Re-binds all earlier bound callbacks.
     * @private
     */
    _rebindCallbacks() {

        // Create a temporary array and clear the real one.
        const callbacks = [...this._callbacks];
        this._callbacks = [];

        // Re-bind the callbacks, since reconnecting a WebSocket isn't officially supported.
        // Binds would be lost while recreating (reconnecting) a socket.
        callbacks.forEach((data) => {
            this._onEvent(data.event, data.callback);
        });
    }

    /**
     * Tries to reconnect to the socket server.
     * @private
     */
    _attemptReconnecting() {
        if(!this._canReconnect)
            return;

        setTimeout(() => {
            this._socket = new WebSocket(this._url);
            this._rebindCallbacks();
        }, RECONNECT_DELAY);
    }
}

const SocketEvent = Object.freeze({
    OPEN: 'open',
    MESSAGE: 'message',
    CONNECTION: 'connection',
    ERROR: 'error',
    CLOSE: 'close'
});

module.exports = WebSocketWrapper;
