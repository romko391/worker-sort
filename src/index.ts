import { IMessage } from './domain/IMessage';
import { Operation } from './domain/Operation';
import { ICommand } from './domain/ICommand';
import { MessageHandler } from './domain/MessageHandler';

const form = document.querySelector('.form') as HTMLFormElement;
const log = document.querySelector('.log') as HTMLLIElement;

interface IWriter<T> {
  write(chunk: T): void;
  clear(): void;
}

class ElementWriter<T extends string> implements IWriter<T> {
  constructor(private readonly element: HTMLElement) {}

  write(chunk: string) {
    const li = document.createElement('li');

    li.textContent = chunk;
    this.element.append(li);

    li.scrollIntoView();
  }

  clear() {
    this.element.innerHTML = '';
  }
}

class Logger<T> {
  constructor(private readonly writer: IWriter<T>) {}

  log(message: T) {
    this.writer.write(message);
  }

  clear() {
    this.writer.clear();
  }
}

export interface IEmitter<T> {
  next(): T;
}
class RandomEmitter implements IEmitter<number> {
  next() {
    return Math.random();
  }
}

class Streamer<T> {
  private timer: number;
  private listener: (x: T) => void;

  constructor(
    private readonly emitter: IEmitter<T>,
    private readonly interval: number
  ) {}

  subscribe(listener: (x: T) => void) {
    this.listener = listener;
  }

  start() {
    this.timer = globalThis.setInterval(() => this.emit(), this.interval);
  }

  emit() {
    this.listener(this.emitter.next());
  }

  terminate() {
    globalThis.clearInterval(this.timer);
  }
}

export interface IMeasureMessage extends IMessage {
  payload: {
    number: number;
    time: number;
  };
}

class PushedCommand implements ICommand {
  readonly type = Operation.PushEnd;

  constructor(
    private readonly logger: Logger<string>,
    private readonly measure: PerformanceMeasure<number>
  ) {}

  execute(message: IMeasureMessage) {
    const { number, time } = message.payload;
    const pushed = this.measure.pushed.get(number);
    const received = time;

    this.measure.pushed.delete(number);

    this.logger.log(`Sending item took: ${received - pushed}ms`);
  }
}
class EnqueuedCommand implements ICommand {
  readonly type = Operation.EnqueueEnd;

  constructor(
    private readonly logger: Logger<string>,
    private readonly measure: PerformanceMeasure<number>
  ) {}

  execute(message: IMeasureMessage) {
    const { number, time } = message.payload;
    const enqueued = this.measure.queued.get(number);
    const received = time;

    this.measure.queued.delete(number);

    this.logger.log(`Enqueuing item took: ${received - enqueued}ms`);
  }
}
class SortingFinishedCommand implements ICommand {
  readonly type = Operation.SortEnd;

  constructor(
    private readonly logger: Logger<string>,
    private readonly measure: PerformanceMeasure<number>
  ) {}

  execute(message: IMessage<number>) {
    const { started } = this.measure;
    const finished = message.payload;

    this.logger.log(`Sorting finished, took: ${finished - started}ms`);
  }
}

class StopStreamingCommand implements ICommand {
  readonly type = Operation.SortEnd;

  constructor(private readonly streamer: Sorter) {}

  execute() {
    this.streamer.dispose();
  }
}

class PerformanceMeasure<T> {
  started: number;
  pushed = new Map<T, number>();
  queued = new Map<T, number>();

  clear() {
    this.started = 0;
    this.pushed.clear();
    this.queued.clear();
  }
}

class SendNextValueCommand implements ICommand {
  readonly type = Operation.PushStart;

  constructor(
    private readonly worker: Worker,
    private readonly measure: PerformanceMeasure<number>
  ) {}

  execute(message: IMessage<number>) {
    const now = Date.now();

    this.measure.pushed.set(message.payload, now);
    this.measure.queued.set(message.payload, now);

    this.worker.postMessage(message);
  }
}
class StartSortingCommand implements ICommand {
  readonly type = Operation.SortStart;

  constructor(
    private readonly worker: Worker,
    private readonly logger: Logger<string>,
    private readonly measure: PerformanceMeasure<number>
  ) {}

  execute(message: IMessage<number>) {
    this.measure.started = Date.now();

    this.worker.postMessage({
      op: message.op
    } as IMeasureMessage);
    this.logger.log('Starting sort.');
  }
}

class Sorter {
  readonly streamer: Streamer<number>;
  readonly logger: Logger<string>;
  readonly worker: Worker;
  readonly receiver: MessageHandler;
  readonly sender: MessageHandler;
  readonly measure: PerformanceMeasure<number>;

  constructor(interval: number) {
    this.worker = new Worker('./worker.ts');
    this.streamer = new Streamer(new RandomEmitter(), interval);
    this.logger = new Logger(new ElementWriter(log));
    this.receiver = new MessageHandler();
    this.sender = new MessageHandler();
    this.measure = new PerformanceMeasure();
  }

  init() {
    this.streamer.subscribe((x) => this.push(x));
    this.worker.onmessage = ({ data }) => this.onmessage(data);

    this.receiver.add(new PushedCommand(this.logger, this.measure));
    this.receiver.add(new EnqueuedCommand(this.logger, this.measure));
    this.receiver.add(new SortingFinishedCommand(this.logger, this.measure));
    this.receiver.add(new StopStreamingCommand(this));

    this.sender.add(new SendNextValueCommand(this.worker, this.measure));
    this.sender.add(
      new StartSortingCommand(this.worker, this.logger, this.measure)
    );
  }

  onmessage(message: IMessage) {
    this.receiver.handle(message);
  }

  start() {
    this.logger.clear();
    this.measure.clear();

    this.sender.handle({
      op: Operation.SortStart
    });
    this.streamer.start();
  }

  push(number: number) {
    const message: IMessage = {
      op: Operation.PushStart,
      payload: number
    };

    this.sender.handle(message);
  }

  dispose() {
    this.streamer.terminate();
    this.worker.terminate();
    this.receiver.clear();
    this.sender.clear();
  }
}

class Runner {
  private sorter: Sorter;

  constructor(private readonly form: HTMLFormElement) {}

  init() {
    this.form.onsubmit = (e) => {
      e.preventDefault();
      this.start();
    };
    this.form.onreset = () => this.dispose();
  }

  start() {
    const interval = +form.interval.value;

    this.sorter = new Sorter(interval);

    this.sorter.init();
    this.sorter.start();
  }

  dispose() {
    this.sorter.dispose();
  }
}

const runner = new Runner(form);

runner.init();
