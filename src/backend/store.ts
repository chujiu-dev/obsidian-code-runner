export type Message = string;
export type Stdio = ReturnType<typeof createStdio>;

export function createStdio<T = Message>() {
  let outputs: T[] = [];
  let subscribers: ((m: T[]) =>  void)[] = [];
  let stdinData = '';

  const update = (setter: (prev: T[]) => T[]) => {
    outputs = setter(outputs);
    for (const s of subscribers) {
      s(outputs);
    }
  };

  const set = (value: T[]) => {
    update(() => value);
  };

  const write = (...data: T[]) => {
    const msg = data.join(',');
    update(n => [...n, msg as unknown as T]);
  };

  const stderr = (...data: T[]) => {
    const msg = data.join(',');
    update(n => [...n, msg as unknown as T]);
  };

  const viewEl = document.createElement('div');
  const clear = () => {
    set([]);
    viewEl.empty();
  };

  const subscribe = (subscriber: (outputs: T[]) =>  void) => {
    subscribers.push(subscriber);
    return () => {
      subscribers = subscribers.filter(s => s !== subscriber);
    };
  };

  const setStdin = (data: string) => {
    stdinData = data;
  };

  const getStdin = () => stdinData;

  // Interactive stdin: called by the Python backend when the Web Worker
  // requests real-time user input via SharedArrayBuffer.
  let stdinResolver: ((data: string) => void) | null = null;
  let stdinSubscribers: ((prompt: string) => void)[] = [];

  const requestStdin = async (prompt: string): Promise<string> => {
    // Notify UI subscribers to show the interactive input field.
    for (const s of stdinSubscribers) {
      s(prompt);
    }
    return new Promise<string>((resolve) => {
      stdinResolver = resolve;
    });
  };

  const provideStdin = (data: string) => {
    if (stdinResolver) {
      stdinResolver(data);
      stdinResolver = null;
    }
  };

  const onStdinRequest = (cb: (prompt: string) => void) => {
    stdinSubscribers.push(cb);
    return () => {
      stdinSubscribers = stdinSubscribers.filter(s => s !== cb);
    };
  };


  return {
    subscribe,
    write,
    viewEl,
    stdout: write,
    stderr,
    clear,
    update,
    set,
    setStdin,
    getStdin,
    requestStdin,
    provideStdin,
    onStdinRequest,
  };
}
