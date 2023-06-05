
import { ObservableData, ITransportEvent } from '@ts-core/common';
import { ITransportSocketRequestPayload, TransportSocketRequestPayload, ITransportSocketResponsePayload, TRANSPORT_SOCKET_CONNECTED, TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, TRANSPORT_SOCKET_EVENT } from '@ts-core/socket-common';
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
        socket.on(TRANSPORT_SOCKET_CONNECTED, this.proxyTransportSocketConnected);

        socket.on(TRANSPORT_SOCKET_EVENT, this.proxyTransportSocketEventRequest);
        socket.on(TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, this.proxyTransportSocketCommandRequest);
        socket.on(TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, this.proxyTransportSocketCommandResponse);
    }

    protected eventListenersRemove(socket: Socket): void {
        socket.off(TRANSPORT_SOCKET_CONNECTED, this.proxyTransportSocketEventRequest);

        socket.off(TRANSPORT_SOCKET_EVENT, this.proxyTransportSocketEventRequest);
        socket.off(TRANSPORT_SOCKET_COMMAND_REQUEST_METHOD, this.proxyTransportSocketCommandRequest);
        socket.off(TRANSPORT_SOCKET_COMMAND_RESPONSE_METHOD, this.proxyTransportSocketCommandResponse);
    }

    // --------------------------------------------------------------------------
    //
    //  Event Handlers
    //
    // --------------------------------------------------------------------------

    private proxyTransportSocketConnected = (): void => this.socketConnectedHandler();

    private proxyTransportSocketEventRequest = <U>(item: ITransportEvent<U>): void => this.transportEventRequestHandler(item);
    private proxyTransportSocketCommandRequest = (item: ITransportSocketRequestPayload): void => this.transportCommandRequestHandler(item);
    private proxyTransportSocketCommandResponse = (item: ITransportSocketResponsePayload): void => this.transportCommandResponseHandler(item);

    protected transportEventRequestHandler<U>(item: ITransportEvent<U>): void {
        if (_.isNil(item) || _.isNil(item.uid)) {
            return;
        }
        this.observer.next(new ObservableData(TransportSocketClientEvent.TRANSPORT_EVENT, item));
    }

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

    public get event(): Observable<ITransportEvent<any>> {
        return this.events.pipe(
            filter(item => item.type === TransportSocketClientEvent.TRANSPORT_EVENT),
            map(item => item.data as ITransportEvent<any>)
        );
    }
    
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

export type TransportSocketClientEventData = ITransportSocketRequestPayload | ITransportSocketResponsePayload | ITransportEvent<any>;

enum TransportSocketClientEvent {
    TRANSPORT_EVENT = 'TRANSPORT_EVENT',
    TRANSPORT_COMMAND_REQUEST = 'TRANSPORT_COMMAND_REQUEST',
    TRANSPORT_COMMAND_RESPONSE = 'TRANSPORT_COMMAND_RESPONSE',
}
