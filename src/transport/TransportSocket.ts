import * as _ from 'lodash';
import { ArrayUtil, ILogger, ITransportCommand, ITransportCommandAsync, ITransportEvent, ITransportSettings } from '@ts-core/common';
import { takeUntil } from 'rxjs';
import { TransportSocketImpl, TRANSPORT_SOCKET_EVENT, ITransportSocketCommandOptions, TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, ITransportSocketEventOptions, ITransportSocketCommandRequest } from '@ts-core/socket-common';
import { TransportSocketClient } from './TransportSocketClient';
import { TransportSocketRoomAction, TransportSocketRoomCommand } from '@ts-core/socket-common';

export class TransportSocket<S extends TransportSocketClient = TransportSocketClient> extends TransportSocketImpl<ITransportSocketSettings> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _socket: S;
    protected _rooms: Array<string>;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, settings: ITransportSocketSettings, socket: S) {
        super(logger, settings);

        this._socket = socket;
        this._rooms = new Array();

        this.socket.completed.pipe(takeUntil(this.destroyed)).subscribe(() => this.connectedHandler());
        this.socket.errored.pipe(takeUntil(this.destroyed)).subscribe(() => this.disconnectedHandler());

        this.socket.transportEvent.pipe(takeUntil(this.destroyed)).subscribe(this.requestEventReceived);
        this.socket.transportRequest.pipe(takeUntil(this.destroyed)).subscribe(this.responseRequestReceived);
        this.socket.transportResponse.pipe(takeUntil(this.destroyed)).subscribe(this.requestResponseReceived);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public roomAdd(name: string): void {
        this.send(new TransportSocketRoomCommand({ action: TransportSocketRoomAction.ADD, name }));
        if (!_.includes(this.rooms, name)) {
            this.rooms.push(name);
        }
    }

    public roomRemove(name: string): void {
        this.send(new TransportSocketRoomCommand({ action: TransportSocketRoomAction.REMOVE, name }));
        if (_.includes(this.rooms, name)) {
            _.remove(this.rooms, name);
        }
    }

    public roomsRemove(): void {
        if (_.isEmpty(this.rooms)) {
            return;
        }
        this.rooms.forEach(item => this.roomRemove(item));
        ArrayUtil.clear(this.rooms);
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
        if (this.settings.isRestoreRoomsOnConnection && !_.isEmpty(this.rooms)) {
            this.rooms.forEach(item => this.roomAdd(item));
        }
    }

    protected async disconnectedHandler(): Promise<void> {
        if (this.settings.isClearRoomsOnDisconnection) {
            this.roomsRemove();
        }
    }

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
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public get rooms(): Array<string> {
        return this._rooms;
    }
    public get socket(): TransportSocketClient {
        return this._socket;
    }
}

export interface ITransportSocketSettings extends ITransportSettings {
    isRestoreRoomsOnConnection?: boolean;
    isClearRoomsOnDisconnection?: boolean;
}