# @ts-core/socket-client

Клиентская библиотека для работы с WebSocket через Socket.IO. Предоставляет абстракции для подключения к серверу, управления состоянием соединения, обработки событий и команд с поддержкой RxJS.

## Установка

```bash
npm install @ts-core/socket-client
```

## Зависимости

- `@ts-core/socket-common` — общие классы и интерфейсы для сокетов
- `socket.io-client` — клиент Socket.IO

## Основные классы

### SocketClient

Базовый абстрактный класс для создания сокет-клиентов:

```typescript
import { SocketClient, ISocketClientBaseSettings } from '@ts-core/socket-client';
import { ILogger } from '@ts-core/common';

class MySocketClient extends SocketClient {
    constructor(logger: ILogger) {
        super(logger, {
            url: 'http://localhost:3000',
            namespace: '/my-namespace'
        });
    }

    protected eventListenersAdd(socket: Socket): void {
        socket.on('my-event', this.handleMyEvent);
    }

    protected eventListenersRemove(socket: Socket): void {
        socket.off('my-event', this.handleMyEvent);
    }

    private handleMyEvent = (data: any) => {
        console.log('Received:', data);
    };
}
```

### Подключение и отключение

```typescript
const client = new MySocketClient(logger);

// Подключение к серверу
await client.connect();
console.log('Connected!');

// Проверка состояния
console.log(client.isConnected);  // true

// Отключение
client.disconnect();
```

### Обработка событий через RxJS

```typescript
import { SocketClient, SocketClientEvent } from '@ts-core/socket-client';

// Подписка на события подключения
client.connected.subscribe(() => {
    console.log('Socket connected');
});

// Подписка на события отключения
client.disconnected.subscribe((error) => {
    console.log('Socket disconnected:', error.message);
});

// Подписка на ошибки подключения
client.connectedError.subscribe((error) => {
    console.log('Connection error:', error.message);
});

// Подписка на ошибки переподключения
client.reconnectedError.subscribe((error) => {
    console.log('Reconnection error:', error.message);
});

// Подписка на неудачное переподключение
client.reconnectedFailed.subscribe(() => {
    console.log('Reconnection failed');
});
```

### TransportSocketClient

Расширенный клиент с поддержкой транспортных команд и событий:

```typescript
import { TransportSocketClient } from '@ts-core/socket-client';

const client = new TransportSocketClient(logger, {
    url: 'http://localhost:3000'
});

await client.connect();

// Отправка данных
client.emit('event-name', { data: 'value' });

// Подписка на транспортные события
client.transportEvent.subscribe((event) => {
    console.log('Transport event:', event.uid, event.data);
});

// Подписка на запросы команд
client.transportRequest.subscribe((request) => {
    console.log('Command request:', request.name, request.request);
});

// Подписка на ответы команд
client.transportResponse.subscribe((response) => {
    console.log('Command response:', response.id, response.response);
});

// Подписка на ошибки транспорта
client.transportError.subscribe((error) => {
    console.log('Transport error:', error.message);
});
```

## API Reference

### SocketClient

| Метод/Свойство | Тип | Описание |
|----------------|-----|----------|
| `connect()` | `Promise<void>` | Подключение к серверу |
| `disconnect()` | `void` | Отключение от сервера |
| `destroy()` | `void` | Уничтожение клиента и освобождение ресурсов |
| `isConnected` | `boolean` | Статус подключения |
| `url` | `string` | URL сервера |
| `settings` | `S` | Настройки клиента |
| `connected` | `Observable<void>` | Observable события подключения |
| `disconnected` | `Observable<ExtendedError>` | Observable события отключения |
| `connectedError` | `Observable<ExtendedError>` | Observable ошибки подключения |
| `reconnectedError` | `Observable<ExtendedError>` | Observable ошибки переподключения |
| `reconnectedFailed` | `Observable<void>` | Observable неудачного переподключения |

### TransportSocketClient

| Метод/Свойство | Тип | Описание |
|----------------|-----|----------|
| `emit<T>(name, data)` | `void` | Отправка события на сервер |
| `transportEvent` | `Observable<ITransportEvent>` | Observable транспортных событий |
| `transportRequest` | `Observable<ITransportSocketRequestPayload>` | Observable запросов команд |
| `transportResponse` | `Observable<ITransportSocketResponsePayload>` | Observable ответов команд |
| `transportError` | `Observable<ExtendedError>` | Observable ошибок транспорта |

### ISocketClientBaseSettings

```typescript
interface ISocketClientBaseSettings extends Partial<ManagerOptions & SocketOptions> {
    url?: string;          // URL сервера
    namespace?: string;    // Namespace для подключения
}
```

### SocketClientEvent

```typescript
enum SocketClientEvent {
    SOCKET_CONNECTED = 'SOCKET_CONNECTED',
    SOCKET_DISCONNECTED = 'SOCKET_DISCONNECTED',
    SOCKET_CONNECT_ERROR = 'SOCKET_CONNECT_ERROR',
    SOCKET_RECONNECT_ERROR = 'SOCKET_RECONNECT_ERROR',
    SOCKET_RECONNECT_FAILED = 'SOCKET_RECONNECT_FAILED',
}
```

## Управление состоянием

Клиент использует `LoadableStatus` для отслеживания состояния:

| Статус | Описание |
|--------|----------|
| `NOT_LOADED` | Не подключен |
| `LOADING` | Идёт подключение |
| `LOADED` | Подключен |
| `ERROR` | Ошибка |

## Пример полного использования

```typescript
import { TransportSocketClient } from '@ts-core/socket-client';
import { LoggerLevel, Logger } from '@ts-core/common';

const logger = new Logger(LoggerLevel.DEBUG);

const client = new TransportSocketClient(logger, {
    url: 'http://localhost:3000',
    namespace: '/api',
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Обработка событий
client.connected.subscribe(() => console.log('Connected'));
client.disconnected.subscribe((e) => console.log('Disconnected:', e?.message));
client.transportEvent.subscribe((event) => console.log('Event:', event));

// Подключение
try {
    await client.connect();
    client.emit('hello', { message: 'Hello, Server!' });
} catch (error) {
    console.error('Failed to connect:', error);
}

// Отключение при завершении
process.on('SIGINT', () => {
    client.destroy();
    process.exit();
});
```

## Связанные пакеты

- `@ts-core/socket-common` — общие классы и интерфейсы
- `@ts-core/socket-server` — серверная реализация

## Автор

**Renat Gubaev** — [renat.gubaev@gmail.com](mailto:renat.gubaev@gmail.com)

- GitHub: [ManhattanDoctor](https://github.com/ManhattanDoctor)
- Repository: [ts-core-socket-client](https://github.com/ManhattanDoctor/ts-core-socket-client)

## Лицензия

ISC
