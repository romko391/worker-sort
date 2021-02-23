import { Operation } from './operation';

export interface IMessage<TPayload = unknown> {
  op: Operation;
  payload?: TPayload;
}
