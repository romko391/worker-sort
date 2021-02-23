import { IMessage } from './IMessage';
import { ICommand } from './ICommand';

export class MessageHandler {
  private readonly commands = new Set<ICommand>();

  add(command: ICommand) {
    this.commands.add(command);
  }

  handle(message: IMessage) {
    for (const command of this.commands) {
      if (command.type === message.op) {
        command.execute(message);
      }
    }
  }

  clear() {
    this.commands.clear();
  }
}
