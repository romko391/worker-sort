import { Operation } from './domain/operation';
import { IMessage } from './domain/message';

const ARRAY_SIZE = 100000;
const BREAK_EVERY = 1000;
const messageHandlers = new Map<Operation, Function>();
let pendingQueue = [];

messageHandlers.set(Operation.Sort, async () => {
  const array = generateArray();

  await sortArray(array);

  self.postMessage({
    op: Operation.Sort,
    payload: Date.now()
  } as IMessage);
});

messageHandlers.set(Operation.Push, (enqueuedItem: number) => {
  pendingQueue.push(enqueuedItem);

  self.postMessage({
    op: Operation.Push,
    payload: Date.now()
  } as IMessage);
});

self.onmessage = ({ data }) => {
  handleMessage(data);
};

function handleMessage({ op, payload }: IMessage) {
  messageHandlers.get(op)?.(payload);
}

function generateArray(size = ARRAY_SIZE) {
  const array = new Array(size).fill(null).map(() => Math.random());

  return array;
}

async function flushCallbackQueue() {
  return new Promise<void>((resolve) => setTimeout(resolve));
}

async function consumePending(array: number[]) {
  await flushCallbackQueue();

  pendingQueue.forEach((item) => {
    array.push(item);

    self.postMessage({
      op: Operation.Enqueue,
      payload: Date.now()
    } as IMessage);
  });
  pendingQueue = [];
}

async function sortArray(array: number[], startAtIndex: number = 0) {
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
      await consumePending(array);

      return sortArray(array, currentIndex);
    }
  }
}
