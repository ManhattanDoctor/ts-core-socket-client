import { ILogger, PromiseHandler, ExtendedError, ObservableData, Loadable, LoadableStatus, LoadableEvent } from '@ts-core/common';
import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import * as _ from 'lodash';

export abstract class SocketClient<U = any, V = any, S extends ISocketClientBaseSettings = ISocketClientBaseSettings> extends Loadable<U, V> {
    
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _socket: Socket;
    protected _settings: S;

    protected error: ExtendedError;
    protected connectionPromise: PromiseHandler<void, ExtendedError>;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(protected logger: ILogger, settings?: S) {
        super();
        this._settings = settings;
    }

    //--------------------------------------------------------------------------
    //
    // 	Protected Methods
    //
    //--------------------------------------------------------------------------

    protected abstract eventListenersAdd(socket: Socket): void;

    protected abstract eventListenersRemove(socket: Socket): void;

    protected commitStatusChangedProperties(oldStatus: LoadableStatus, newStatus: LoadableStatus): void {
        super.commitStatusChangedProperties(oldStatus, newStatus);

        switch (newStatus) {
            case LoadableStatus.LOADING:
                this.observer.next(new ObservableData(LoadableEvent.STARTED));
                break;
            case LoadableStatus.LOADED:
                this.observer.next(new ObservableData(LoadableEvent.COMPLETE));
                break;
            case LoadableStatus.ERROR:
            case LoadableStatus.NOT_LOADED:
                this.observer.next(new ObservableData(LoadableEvent.ERROR, null, this.error));
                break;
        }

        if (oldStatus === LoadableStatus.LOADING) {
            this.observer.next(new ObservableData(LoadableEvent.FINISHED));
        }
    }

    protected connectionResolve(): void {
        if (!_.isNil(this.connectionPromise)) {
            this.connectionPromise.resolve();
        }
    }

    protected connectionReject(): void {
        if (!_.isNil(this.connectionPromise)) {
            this.connectionPromise.reject(this.error);
            this.connectionPromise = null;
        }
    }

    protected createSocket(): Socket {
        return io(this.url, this.settings).connect();
    }

    // --------------------------------------------------------------------------
    //
    //  Socket Methods
    //
    // --------------------------------------------------------------------------

    public async connect(): Promise<void> {
        if (!_.isNil(this.connectionPromise)) {
            return this.connectionPromise.promise;
        }

        this.socket = this.createSocket();
        this.status = LoadableStatus.LOADING;

        this.connectionPromise = PromiseHandler.create();
        return this.connectionPromise.promise;
    }

    public disconnect(): void {
        if (this.status === LoadableStatus.NOT_LOADED) {
            return;
        }
        this.socket = null;
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();
        this.disconnect();

        this._settings = null;
        this.logger = null;
    }

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    private proxySocketConnectErrorHandler = (event: any): void => this.socketConnectErrorHandler(event);

    private proxySocketConnectedHandler = (): void => this.socketConnectedHandler();

    private proxySocketDisconnectedHandler = (reason: string): void => this.socketDisconnectedHandler(reason);

    private proxySocketReconnectErrorHandler = (event: any): void => this.socketReconnectErrorHandler(event);

    private proxySocketReconnectFailedHandler = (): void => this.socketReconnectFailedHandler();

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    protected commitSettingsProperties(): void { }

    protected socketConnectedHandler(): void {
        this.error = null;
        this.status = LoadableStatus.LOADED;
        this.connectionResolve();
    }

    protected socketDisconnectedHandler(reason: string): void {
        this.error = new ExtendedError(reason);
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    protected socketConnectErrorHandler(event: any): void {
        this.error = ExtendedError.create(event);
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    protected socketReconnectErrorHandler(event: any): void {
        this.error = ExtendedError.create(event);
    }

    protected socketReconnectFailedHandler(): void {
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    //--------------------------------------------------------------------------
    //
    // 	Private Properties
    //
    //--------------------------------------------------------------------------

    protected get socket(): Socket {
        return this._socket;
    }

    protected set socket(value: Socket) {
        if (value === this._socket) {
            return;
        }

        if (!_.isNil(this._socket)) {
            this.eventListenersRemove(this._socket);
            this._socket.off('connect', this.proxySocketConnectedHandler);
            this._socket.off('disconnect', this.proxySocketDisconnectedHandler);
            this._socket.off('connect_error', this.proxySocketConnectErrorHandler);
            this._socket.io.off('reconnect_error', this.proxySocketReconnectErrorHandler);
            this._socket.io.off('reconnect_failed', this.proxySocketReconnectFailedHandler);
            this._socket.disconnect();
        }

        this._socket = value;

        if (!_.isNil(this._socket)) {
            this.eventListenersAdd(this._socket);
            this._socket.on('connect', this.proxySocketConnectedHandler);
            this._socket.on('disconnect', this.proxySocketDisconnectedHandler);
            this._socket.on('connect_error', this.proxySocketConnectErrorHandler);
            this._socket.io.on('reconnect_error', this.proxySocketReconnectErrorHandler);
            this._socket.io.on('reconnect_failed', this.proxySocketReconnectFailedHandler);
        }
    }

    //--------------------------------------------------------------------------
    //
    // 	Public Properties
    //
    //--------------------------------------------------------------------------

    public get query(): SocketClientQuery {
        return !_.isNil(this.settings) ? this.settings.query : null;
    }
    public set query(value: SocketClientQuery) {
        if (_.isNil(this.settings)) {
            this.settings = {} as any;
        }
        this.settings.query = value;
    }

    public get url(): string {
        return !_.isNil(this.settings) ? this.settings.url : null;
    }
    public set url(value: string) {
        if (_.isNil(this.settings)) {
            this.settings = {} as any;
        }
        this.settings.url = value;
    }

    public get settings(): S {
        return this._settings;
    }
    public set settings(value: S) {
        if (value === this._settings) {
            return;
        }
        this._settings = value;
        if (!_.isNil(value)) {
            this.commitSettingsProperties();
        }
    }
}

export interface ISocketClientBaseSettings extends Partial<ManagerOptions & SocketOptions> {
    url?: string;
}

export type SocketClientQuery = Record<string, any>;
