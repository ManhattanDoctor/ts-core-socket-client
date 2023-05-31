
import { ObservableData } from '@ts-core/common';
import { ITransportSocketRequestPayload, TransportSocketRequestPayload, ITransportSocketResponsePayload, TRANSPORT_SOCKET_CONNECTED_EVENT, TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD } from '@ts-core/socket-common';
import { filter, map, Observable } from 'rxjs';
import { Socket } from 'socket.io-client';
import * as _ from 'lodash';
import { ISocketClientBaseSettings, SocketClient } from '../SocketClient';

export class TransportSocketClient<S extends ISocketClientBaseSettings = ISocketClientBaseSettings> extends SocketClient<S, TransportSocketClientEvent, TransportSocketClientEventData> {

    // --------------------------------------------------------------------------
    //
    //  Protected Methods
    //
    // --------------------------------------------------------------------------

    protected eventListenersAdd(socket: Socket): void {
        socket.on(TRANSPORT_SOCKET_CONNECTED_EVENT, this.proxyTransportSocketConnected);
        socket.on(TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, this.proxyTransportSocketCommandRequest);
        socket.on(TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, this.proxyTransportSocketCommandResponse);
    }

    protected eventListenersRemove(socket: Socket): void {
        socket.off(TRANSPORT_SOCKET_CONNECTED_EVENT, this.proxyTransportSocketConnected);
        socket.off(TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, this.proxyTransportSocketCommandRequest);
        socket.off(TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, this.proxyTransportSocketCommandResponse);
    }

    // --------------------------------------------------------------------------
    //
    //  Event Handlers
    //
    // --------------------------------------------------------------------------

    private proxyTransportSocketConnected = (): void => this.socketConnectedHandler();
    private proxyTransportSocketCommandRequest = (item: ITransportSocketRequestPayload): void => this.transportCommandRequestHandler(item);
    private proxyTransportSocketCommandResponse = (item: ITransportSocketResponsePayload): void => this.transportCommandResponseHandler(item);

    protected transportCommandRequestHandler(item: ITransportSocketRequestPayload): void {
        if (_.isNil(item) || _.isNil(item.id)) {
            return;
        }
        TransportSocketRequestPayload.setDefaultOptions(item);
        this.observer.next(new ObservableData(TransportSocketClientEvent.TRANSPORT_COMMAND_REQUEST, item));
    }

    protected transportCommandResponseHandler(item: ITransportSocketResponsePayload): void {
        if (_.isNil(item) || _.isNil(item.id)) {
            return;
        }
        this.observer.next(new ObservableData(TransportSocketClientEvent.TRANSPORT_COMMAND_RESPONSE, item));
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public async emit<T>(name: string, data: T): Promise<void> {
        this.socket.emit(name, data);
    }

    // --------------------------------------------------------------------------
    //
    //  Event Handlers
    //
    // --------------------------------------------------------------------------

    public get request(): Observable<ITransportSocketRequestPayload> {
        return this.events.pipe(
            filter(item => item.type === TransportSocketClientEvent.TRANSPORT_COMMAND_REQUEST),
            map(item => item.data as ITransportSocketRequestPayload)
        );
    }

    public get response(): Observable<ITransportSocketResponsePayload> {
        return this.events.pipe(
            filter(item => item.type === TransportSocketClientEvent.TRANSPORT_COMMAND_RESPONSE),
            map(item => item.data as ITransportSocketResponsePayload)
        );
    }
}

export type TransportSocketClientEventData = ITransportSocketRequestPayload | ITransportSocketResponsePayload;

enum TransportSocketClientEvent {
    TRANSPORT_COMMAND_REQUEST = 'TRANSPORT_COMMAND_REQUEST',
    TRANSPORT_COMMAND_RESPONSE = 'TRANSPORT_COMMAND_RESPONSE',
}
