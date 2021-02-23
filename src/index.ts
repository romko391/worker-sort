import { IMessage } from './domain/message';
import { Operation } from './domain/operation';

const form = document.querySelector('.form') as HTMLFormElement;
const log = document.querySelector('.log') as HTMLLIElement;

const messageHandlers = new Map<Operation, Function>();

let worker: Worker;
let timer: number;
let timeStarted: number;
let pushedStack = [];
let enqueuedStack = [];

form.onsubmit = (e) => {
  const interval = Number.parseInt(form.interval.value);

  e.preventDefault();

  clearMessageLog();
  disableForm();
  createWorker();

  startSorting();

  if (!Number.isNaN(interval)) {
    scheduleRandom(interval);
  }
};

form.onreset = () => {
  finishSorting();
};

messageHandlers.set(Operation.Sort, (timeSorted: number) => {
  logMessage(`Sorting finished: ${timeSorted - timeStarted}ms`);
  finishSorting();
});

messageHandlers.set(Operation.Push, (timeAccepted: number) => {
  const timePushed = pushedStack.shift();

  logMessage(`Sending item took: ${timeAccepted - timePushed}ms`);
});

messageHandlers.set(Operation.Enqueue, (timeEnqueued: number) => {
  const timePushed = enqueuedStack.shift();

  logMessage(`Processing item took: ${timeEnqueued - timePushed}ms`);
});

function finishSorting() {
  clearSchedule();
  clearLogStacks();
  terminateWorker();
  enableForm();
}

function logMessage(message: string) {
  const element = document.createElement('li');

  element.textContent = message;

  log.appendChild(element);
  element.scrollIntoView();
}

function clearSchedule() {
  clearInterval(timer);
}

function clearLogStacks() {
  pushedStack = [];
  enqueuedStack = [];
}

function clearMessageLog() {
  log.innerHTML = '';
}

function createWorker() {
  worker = new Worker('./worker.ts');

  worker.onmessage = ({ data }) => {
    handleMessage(data);
  };
}

function terminateWorker() {
  worker.terminate();
}

function disableForm() {
  const controls = form.querySelectorAll('input,[type=submit]');

  Array.from(controls).forEach((c) => c.setAttribute('disabled', 'disabled'));
  form.querySelector('[type=reset]').removeAttribute('disabled');
}

function enableForm() {
  const controls = form.querySelectorAll('input,[type=submit]');

  Array.from(controls).forEach((c) => c.removeAttribute('disabled'));
  form.querySelector('[type=reset]').setAttribute('disabled', 'disabled');
}

function handleMessage({ op, payload }: IMessage) {
  messageHandlers.get(op)?.(payload);
}

function startSorting() {
  const message: IMessage = {
    op: Operation.Sort
  };

  timeStarted = Date.now();
  logMessage('Sorting started.');
  worker.postMessage(message);
}

function scheduleRandom(interval: number) {
  timer = setInterval(() => {
    const message: IMessage<number> = {
      op: Operation.Push,
      payload: Math.random()
    };

    pushedStack.push(Date.now());
    enqueuedStack.push(Date.now());
    worker.postMessage(message);
  }, interval);
}
