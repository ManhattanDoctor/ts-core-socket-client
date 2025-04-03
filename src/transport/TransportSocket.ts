import { ArrayUtil, ILogger, ITransportCommand, ITransportCommandAsync, ITransportEvent, ITransportSettings, UnreachableStatementError } from '@ts-core/common';
import { takeUntil } from 'rxjs';
import { TransportSocketImpl, TRANSPORT_SOCKET_EVENT, ITransportSocketCommandOptions, TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, ITransportSocketEventOptions, ITransportSocketCommandRequest, ITransportSocketRoomDto } from '@ts-core/socket-common';
import { TransportSocketClient } from './TransportSocketClient';
import { TransportSocketRoomAction, TransportSocketRoomCommand } from '@ts-core/socket-common';
import * as _ from 'lodash';

export class TransportSocket<S extends TransportSocketClient = TransportSocketClient> extends TransportSocketImpl<ITransportSocketSettings> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _rooms: Set<string>;
    protected _socket: S;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, settings: ITransportSocketSettings, socket: S) {
        super(logger, settings);

        this._socket = socket;
        this._rooms = new Set();

        this.socket.connected.pipe(takeUntil(this.destroyed)).subscribe(() => this.connectedHandler());
        this.socket.disconnected.pipe(takeUntil(this.destroyed)).subscribe(() => this.disconnectedHandler());
        this.socket.reconnectedFailed.pipe(takeUntil(this.destroyed)).subscribe(() => this.reconnectedFailedHandler());

        this.socket.transportEvent.pipe(takeUntil(this.destroyed)).subscribe(this.requestEventReceived);
        this.socket.transportRequest.pipe(takeUntil(this.destroyed)).subscribe(this.responseRequestReceived);
        this.socket.transportResponse.pipe(takeUntil(this.destroyed)).subscribe(this.requestResponseReceived);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public connect(): Promise<void> {
        return this.socket.connect();
    }

    public disconnect(): void {
        if (this.settings.isClearRoomsOnDisconnect) {
            this.roomsRemove();
        }
        this.socket.disconnect();
    }

    // --------------------------------------------------------------------------
    //
    //  Room Protected Methods
    //
    // --------------------------------------------------------------------------

    protected async roomHandler(item: ITransportSocketRoomDto): Promise<string> {
        let { action, name } = item;
        switch (action) {
            case TransportSocketRoomAction.ADD:
                return this.roomAdd(name);
            case TransportSocketRoomAction.REMOVE:
                return this.roomRemove(name);
            default:
                throw new UnreachableStatementError(action);
        }
    }

    protected async _roomAdd(name: string): Promise<string> {
        try {
            return this.sendListen(new TransportSocketRoomCommand({ action: TransportSocketRoomAction.ADD, name }));
        }
        catch (error) {
            this.warn(`Unable to add room "${name}": ${error.message}`);
            throw error;
        }
    }

    protected async _roomRemove(name: string): Promise<string> {
        try {
            return this.sendListen(new TransportSocketRoomCommand({ action: TransportSocketRoomAction.REMOVE, name }));
        }
        catch (error) {
            this.warn(`Unable to remove room "${name}": ${error.message}`);
            throw error;
        }
    }

    // --------------------------------------------------------------------------
    //
    //  Room Public Methods
    //
    // --------------------------------------------------------------------------

    public async roomAdd(name: string): Promise<string> {
        if (this.rooms.has(name)) {
            return name;
        }
        this.rooms.add(name);
        try {
            await this._roomAdd(name);
        }
        catch (error) {
            this.rooms.delete(name);
        }
        return name;
    }

    public async roomRemove(name: string): Promise<string> {
        if (!this.rooms.has(name)) {
            return name;
        }
        this.rooms.delete(name);
        try {
            await this._roomRemove(name);
        }
        catch (error) {
            this.rooms.add(name);
        }
        return name;
    }

    public async roomsRemove(): Promise<void> {
        if (this.rooms.size === 0) {
            return;
        }
        await Promise.all(Array.from(this.rooms.values()).map(item => this.roomRemove(item)));
        this.rooms.clear();
    }

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();
        this._rooms = null;
        this._socket = null;
    }

    // --------------------------------------------------------------------------
    //
    //  Event Handlers
    //
    // --------------------------------------------------------------------------

    protected async connectedHandler(): Promise<void> {
        if (this.settings.isRestoreRoomsOnConnect && !_.isEmpty(this.rooms)) {
            this.rooms.forEach(item => this.roomAdd(item));
        }
    }

    protected async disconnectedHandler(): Promise<void> {
        if (this.settings.isClearRoomsOnDisconnect) {
            this.roomsRemove();
        }
    }

    protected async reconnectedFailedHandler(): Promise<void> { }

    // --------------------------------------------------------------------------
    //
    //  Protected Methods
    //
    // --------------------------------------------------------------------------

    protected async eventRequestExecute<U>(event: ITransportEvent<U>, options?: ITransportSocketEventOptions): Promise<void> {
        try {
            await this.socket.emit(TRANSPORT_SOCKET_EVENT, event);
        }
        catch (error) {
            this.eventRequestErrorCatch(event, options, error);
        }
    }

    protected async commandRequestExecute<U>(command: ITransportCommand<U>, options: ITransportSocketCommandOptions, isNeedReply: boolean): Promise<void> {
        let payload = this.createRequestPayload(command, options, isNeedReply);
        try {
            await this.socket.emit(TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, payload);
        }
        catch (error) {
            this.commandRequestErrorCatch(command, options, isNeedReply, error);
        }
    }

    protected async commandResponseExecute<U, V>(command: ITransportCommandAsync<U, V>, request: ITransportSocketCommandRequest): Promise<void> {
        let payload = this.createResponsePayload(command, request);
        try {
            await this.socket.emit(TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, payload);
        }
        catch (error) {
            this.commandResponseErrorCatch(command, request, error);
        }
    }

    // --------------------------------------------------------------------------
    //
    //  Public Properties
    //
    // --------------------------------------------------------------------------

    public get rooms(): Set<string> {
        return this._rooms;
    }

    public get socket(): TransportSocketClient {
        return this._socket;
    }

    public get url(): string {
        return this.socket.url;
    }

    public set url(value: string) {
        this.socket.url = value;
    }
}

export interface ITransportSocketSettings extends ITransportSettings {
    isRestoreRoomsOnConnect?: boolean;
    isClearRoomsOnDisconnect?: boolean;
}