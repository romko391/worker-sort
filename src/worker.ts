import { MessageHandler } from './domain/MessageHandler';
import { Operation } from './domain/Operation';
import { IMessage } from './domain/IMessage';
import { ICommand } from './domain/ICommand';

const ARRAY_SIZE = 100000;
const BREAK_EVERY = 1000;

class WorkerSorter {
  readonly queue: number[] = [];
  readonly sender: MessageHandler;

  constructor() {
    this.sender = new MessageHandler();
  }

  init() {
    this.sender.add(new EnqueueCommand());
  }

  enqueue(number: number) {
    this.queue.push(number);
  }

  async start(array: number[]) {
    await this.sort(array, 0);
  }

  async flush() {
    return new Promise<void>((resolve) => setTimeout(resolve));
  }

  async consume(array: number[]) {
    await this.flush();

    this.queue.forEach((number) => {
      array.push(number);

      this.sender.handle({
        op: Operation.EnqueueEnd,
        payload: number
      });
    });
    this.queue.splice(0);
  }

  async sort(array: number[], startAtIndex: number = 0) {
    let currentIndex = startAtIndex;

    while (++currentIndex < array.length) {
      const currentElement = array[currentIndex];
      let targetIndex = currentIndex;

      while (targetIndex > 0 && array[targetIndex - 1] > currentElement) {
        targetIndex--;
      }

      if (currentIndex !== targetIndex) {
        array.splice(currentIndex, 1);
        array.splice(targetIndex, 0, currentElement);
      }

      if (currentIndex % BREAK_EVERY === 0) {
        await this.consume(array);

        return this.sort(array, currentIndex);
      }
    }
  }
}

class SortCommand implements ICommand {
  readonly type = Operation.SortStart;

  constructor(private readonly sorter: WorkerSorter) {}

  async execute() {
    const array = new Array(ARRAY_SIZE).fill(null).map(() => Math.random());

    await this.sorter.start(array);

    self.postMessage({
      op: Operation.SortEnd,
      payload: Date.now()
    } as IMessage);
  }
}

class PushCommand implements ICommand {
  readonly type = Operation.PushStart;

  constructor(private readonly sorter: WorkerSorter) {}

  execute({ payload }: IMessage<number>) {
    this.sorter.enqueue(payload);

    self.postMessage({
      op: Operation.PushEnd,
      payload: {
        number: payload,
        time: Date.now()
      }
    } as IMessage);
  }
}
class EnqueueCommand implements ICommand {
  readonly type = Operation.EnqueueEnd;

  execute({ payload }: IMessage<number>) {
    self.postMessage({
      op: Operation.EnqueueEnd,
      payload: {
        number: payload,
        time: Date.now()
      }
    } as IMessage);
  }
}

class WorkerRunner {
  readonly sorter: WorkerSorter;
  readonly receiver: MessageHandler;

  constructor() {
    this.sorter = new WorkerSorter();
    this.receiver = new MessageHandler();

    self.onmessage = ({ data }) => this.receiver.handle(data);
  }

  init() {
    this.sorter.init();

    this.receiver.add(new SortCommand(this.sorter));
    this.receiver.add(new PushCommand(this.sorter));
  }
}

const runner = new WorkerRunner();

runner.init();
