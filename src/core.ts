import { augment, DeepReadonly, Derivation, Future, FutureState, Readable } from 'olik';

type SvelteStore<T> = { subscribe: (run: (value: T) => any, invalidate?: any) => any }

declare module 'olik' {
  interface Readable<S> {
    $observe: () => SvelteStore<S>;
  }
  interface Derivation<R> {
    $observe: () => SvelteStore<R>;
  }
  interface Future<C> {
    $observe: (args: { fetchImmediately: boolean }) => SvelteStore<FutureState<C>> & ({ get: () => void });
  }
  interface StoreAugment<S> extends SvelteStore<S> {
  }
}

type Callback<T> = (arg: DeepReadonly<T>) => void;

export const augmentOlikForSvelte = () => {
  augment({
    core: {
      subscribe: <C>(input: Readable<C>) => (callback: Callback<C>) => {
        callback(input.$state);
        const sub = input.$onChange(v => callback(v));
        return () => sub.unsubscribe();
      }
    },
    selection: {
      $observe: <S>(input: Readable<S>) => () => ({
        subscribe: (callback: Callback<S>) => {
          callback(input.$state);
          const sub = input.$onChange(v => callback(v));
          return () => sub.unsubscribe();
        }
      }),
    },
    derivation: {
      $observe: <C>(input: Derivation<C>) => () => ({
        subscribe: (callback: Callback<C>) => {
          callback(input.$state);
          const sub = input.$onChange(v => callback(v));
          return () => sub.unsubscribe();
        }
      }),
    },
    future: {
      $observe: <C>(input: Future<C>) => (args: { fetchImmediately: boolean }) => {
        let running = args.fetchImmediately;
        let callback: Callback<FutureState<C>>;
        const updateState = () => {
          callback(input.state)
          running = false;
        }
        const get = () => {
          input
            .then(() => updateState())
            .catch(() => updateState());
          // We are re-using the same ref, so we must manually reset its state to help with re-fetches
          callback({ ...input.state, isLoading: true });
        }
        return {
          subscribe: (cb: Callback<FutureState<C>>) => {
            callback = cb;
            callback(input.state);
            if (args.fetchImmediately) { get(); }
            return () => running = false;
          },
          get,
        }
      }
    }
  })
}
