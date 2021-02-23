import { IMessage } from './message';
import { Operation } from './operation';

export interface ICommand {
  type: Operation;
  execute(message: IMessage): void;
}
