import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const HISTORY_LIMIT = 100;
const history = [];
let nextEventId = 1;

export const publishDataChange = ({ resource, action, id }) => {
  const event = {
    eventId: String(nextEventId++),
    resource,
    action,
    id: id ?? null,
    timestamp: new Date().toISOString(),
  };

  history.push(event);
  if (history.length > HISTORY_LIMIT) history.shift();
  emitter.emit("data-change", event);
  return event;
};

export const subscribeToDataChanges = (listener, lastEventId) => {
  if (lastEventId) {
    const lastId = Number(lastEventId);
    if (Number.isSafeInteger(lastId)) {
      for (const event of history) {
        if (Number(event.eventId) > lastId) listener(event);
      }
    }
  }

  emitter.on("data-change", listener);
  return () => emitter.off("data-change", listener);
};
