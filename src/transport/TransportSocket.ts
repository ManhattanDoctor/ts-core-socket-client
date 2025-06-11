import { ILogger, ITransportCommand, ITransportCommandAsync, ITransportEvent, ITransportSettings, UnreachableStatementError } from '@ts-core/common';
import { TransportSocketImpl, TRANSPORT_SOCKET_EVENT, ITransportSocketCommandOptions, TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, ITransportSocketEventOptions, ITransportSocketCommandRequest, ITransportSocketRoomDto } from '@ts-core/socket-common';
import { TransportSocketClient } from './TransportSocketClient';
import { TransportSocketRoomAction, TransportSocketRoomCommand } from '@ts-core/socket-common';
import { takeUntil } from 'rxjs';
import * as _ from 'lodash';

export class TransportSocket<S extends TransportSocketClient = TransportSocketClient> extends TransportSocketImpl<ITransportSocketSettings> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected rooms: Map<string, ITransportSocketRoom>;
    protected _socket: S;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, settings: ITransportSocketSettings, socket: S) {
        super(logger, settings);

        this._socket = socket;
        this.rooms = new Map();

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

    protected async roomAddIfNeed(item: ITransportSocketRoom, isForce?: boolean): Promise<void> {
        if (item.listeners > 0 && !isForce) {
            return;
        }
        if (!this.socket.isConnected) {
            return;
        }
        try {
            await this.sendListen(new TransportSocketRoomCommand({ action: TransportSocketRoomAction.ADD, name: item.name }));
        }
        catch (error) {
            this.warn(`Unable to add room "${item.name}": ${error.message}`);
            throw error;
        }
        finally {
            this.checkRoom(item);
        }
    }

    protected async roomRemoveIfNeed(item: ITransportSocketRoom, isForce?: boolean): Promise<void> {
        if (item.listeners > 0 && !isForce) {
            return;
        }
        if (!this.socket.isConnected) {
            return;
        }
        try {
            await this.sendListen(new TransportSocketRoomCommand({ action: TransportSocketRoomAction.REMOVE, name: item.name }));
        }
        catch (error) {
            this.warn(`Unable to remove room "${item.name}": ${error.message}`);
            throw error;
        }
        finally {
            this.checkRoom(item);
        }
    }

    protected async roomsAdd(): Promise<void> {
        if (this.rooms.size === 0) {
            return;
        }
        for (let item of Array.from(this.rooms.values())) {
            await this.roomAddIfNeed(item, true);
        }
    }

    protected async roomsRemove(): Promise<void> {
        if (this.rooms.size === 0) {
            return;
        }
        for (let item of Array.from(this.rooms.values())) {
            await this.roomRemoveIfNeed(item, true);
        }
        this.rooms.clear();
    }

    protected checkRoom(item: ITransportSocketRoom): void {
        let { name, listeners } = item;
        if (listeners === 0) {
            this.rooms.delete(name);
        }
    }

    // --------------------------------------------------------------------------
    //
    //  Room Public Methods
    //
    // --------------------------------------------------------------------------

    public async roomAdd(name: string): Promise<string> {
        if (!this.rooms.has(name)) {
            this.rooms.set(name, { name, listeners: 0 });
        }
        let item = this.rooms.get(name);
        this.roomAddIfNeed(item);
        item.listeners++;
        return name;
    }

    public async roomRemove(name: string): Promise<string> {
        if (!this.rooms.has(name)) {
            return name;
        }
        let item = this.rooms.get(name);
        item.listeners--;
        this.roomRemoveIfNeed(item);
        return name;
    }

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();
        this.rooms = null;
        this._socket = null;
    }

    // --------------------------------------------------------------------------
    //
    //  Event Handlers
    //
    // --------------------------------------------------------------------------

    protected async connectedHandler(): Promise<void> {
        if (this.settings.isRestoreRoomsOnConnect) {
            await this.roomsAdd();
        }
    }

    protected async disconnectedHandler(): Promise<void> {
        if (this.settings.isClearRoomsOnDisconnect) {
            await this.roomsRemove();
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
            this.socket.emit(TRANSPORT_SOCKET_EVENT, event);
        }
        catch (error) {
            this.eventRequestErrorCatch(event, options, error);
        }
    }

    protected async commandRequestExecute<U>(command: ITransportCommand<U>, options: ITransportSocketCommandOptions, isNeedReply: boolean): Promise<void> {
        let payload = this.createRequestPayload(command, options, isNeedReply);
        try {
            this.socket.emit(TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, payload);
        }
        catch (error) {
            this.commandRequestErrorCatch(command, options, isNeedReply, error);
        }
    }

    protected async commandResponseExecute<U, V>(command: ITransportCommandAsync<U, V>, request: ITransportSocketCommandRequest): Promise<void> {
        let payload = this.createResponsePayload(command, request);
        try {
            this.socket.emit(TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, payload);
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

interface ITransportSocketRoom {
    name: string;
    listeners: number;
}

export interface ITransportSocketSettings extends ITransportSettings {
    isRestoreRoomsOnConnect?: boolean;
    isClearRoomsOnDisconnect?: boolean;
}