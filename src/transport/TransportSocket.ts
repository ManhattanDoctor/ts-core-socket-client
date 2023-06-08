import * as _ from 'lodash';
import { ILogger, ITransportCommand, ITransportCommandAsync, ITransportEvent, ITransportSettings } from '@ts-core/common';
import { takeUntil } from 'rxjs';
import { TransportSocketImpl, TRANSPORT_SOCKET_EVENT, ITransportSocketCommandOptions, TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, ITransportSocketEventOptions, ITransportSocketCommandRequest } from '@ts-core/socket-common';
import { TransportSocketClient } from './TransportSocketClient';

export class TransportSocket<S extends TransportSocketClient = TransportSocketClient> extends TransportSocketImpl {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _socket: S;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, settings: ITransportSettings, socket: S) {
        super(logger, settings);
        this._socket = socket;
        this.socket.evented.pipe(takeUntil(this.destroyed)).subscribe(this.requestEventReceived);
        this.socket.requested.pipe(takeUntil(this.destroyed)).subscribe(this.responseRequestReceived);
        this.socket.responsed.pipe(takeUntil(this.destroyed)).subscribe(this.requestResponseReceived);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();
        this._socket = null;
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

    public get socket(): TransportSocketClient {
        return this._socket;
    }
}
