//@flow

import {sample, Kind, createEvent, createStore, createEffect} from 'effector'

import {spy, getSpyCalls} from 'effector/fixtures'

it('should not accept undefined clocks', () => {
  expect(() => {
    sample({
      source: createStore(null),
      clock: undefined,
    })
  }).toThrowErrorMatchingInlineSnapshot(`"config.clock should be defined"`)
})

describe('sample type', () => {
  test.each`
    source            | clock             | kind
    ${createStore(0)} | ${createStore(0)} | ${Kind.store}
    ${createStore(0)} | ${createEvent()}  | ${Kind.event}
    ${createEvent()}  | ${createStore(0)} | ${Kind.event}
    ${createEvent()}  | ${createEvent()}  | ${Kind.event}
  `(`$kind <- $source.kind by $clock.kind`, ({source, clock, kind}) => {
    expect(sample(source, clock).kind).toBe(kind)
  })
  test.each`
    source            | clock             | kind
    ${createStore(0)} | ${createStore(0)} | ${Kind.store}
    ${createStore(0)} | ${createEvent()}  | ${Kind.event}
    ${createEvent()}  | ${createStore(0)} | ${Kind.event}
    ${createEvent()}  | ${createEvent()}  | ${Kind.event}
  `(
    `$kind <- $source.kind by $clock.kind with handler`,
    ({source, clock, kind}) => {
      expect(
        sample(source, clock, (source, clock) => ({source, clock})).kind,
      ).toBe(kind)
    },
  )
})

describe('sample', () => {
  it('works with config', () => {
    const foo = createStore('')
    const bar = createStore('')

    //$todo
    sample({clock: foo, source: foo, target: bar})
  })
  it('handles object combination', () => {
    const foo = createStore('')
    //$todo
    sample({foo})
  })
  it('works with single source', () => {
    const foo = createStore('')

    sample(foo)
  })
  describe('sample with event as source', () => {
    describe.each`
      greedy   | resultDirect                      | resultBacktracking
      ${false} | ${[[{x: 1}], [{x: 2}], [{x: 3}]]} | ${[[{x: 2}], [{x: 3}]]}
      ${true}  | ${[[{x: 1}], [{x: 2}], [{x: 3}]]} | ${[[{x: 1}], [{x: 2}]]}
    `(
      'depended on order of execution (greedy = $greedy)',
      ({greedy, resultDirect, resultBacktracking}) => {
        test('direct order', () => {
          const A = createEvent()
          const B = A.map(x => ({x}))

          //$todo
          sample(A, B, (A, B) => B, greedy).watch(e => spy(e))

          A(1)
          A(2)
          A(3)

          expect(getSpyCalls()).toEqual(resultDirect)
        })
        test('backtracking', () => {
          const A = createEvent()
          const B = A.map(x => ({x}))

          //$todo
          sample(B, A, B => B, greedy).watch(e => spy(e))

          A(1)
          A(2)
          A(3)

          expect(getSpyCalls()).toEqual(resultBacktracking)
        })
      },
    )

    it('works with sibling events', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()
      const A = createEvent()
      const B = A.map(b => ({b}))
      const C = A.filter(x => {
        if (x > 5) return `${x} > 5`
      })

      sample(B, C, ({b}, c) => ({b, c})).watch(e => fn1(e))
      sample(C, B, (c, {b}) => ({b, c})).watch(e => fn2(e))

      A(2)
      A(6)
      A(3)
      A(4)
      A(10)
      expect(fn1.mock.calls).toEqual([
        [{b: 6, c: `6 > 5`}],
        [{b: 10, c: `10 > 5`}],
      ])
      expect(fn2.mock.calls).toEqual([
        [{b: 3, c: `6 > 5`}],
        [{b: 4, c: `6 > 5`}],
        [{b: 10, c: `10 > 5`}],
      ])
    })
    test('event', () => {
      const data = createEvent('data')
      const stop = createEvent('stop')

      const lastData = sample(data, stop)

      lastData.watch(value => spy(value))

      data({foo: 'bar'})
      data(true)
      data(false)
      data({x: 'baz'})

      stop()

      expect(getSpyCalls()).toEqual([[{x: 'baz'}]])
      expect(spy).toHaveBeenCalledTimes(1)
    })
    test('no updates until first source update', () => {
      const data = createEvent('data')
      const stop = createEvent('stop')

      const lastData = sample(data, stop)

      lastData.watch(value => spy(value))

      stop()
      stop()
      expect(spy).not.toHaveBeenCalled()
      data({x: 'baz'})
      expect(spy).not.toHaveBeenCalled()
      stop()
      expect(getSpyCalls()).toEqual([[{x: 'baz'}]])
      expect(spy).toHaveBeenCalledTimes(1)
    })
    test(
      'edge case: no updates until first source update ' +
        'even when clock is store',
      () => {
        const data = createEvent('data')
        const add = createEvent('+ n')
        const stop = createStore(0).on(add, (x, n) => x + n)

        const lastData = sample(data, stop)

        lastData.watch(value => spy(value))

        add(1)
        add(2)
        expect(spy).not.toHaveBeenCalled()
        data({x: 'baz'})
        add(0) //edge case: store will not be updated
        expect(spy).not.toHaveBeenCalled()
        add(3)
        expect(getSpyCalls()).toEqual([[{x: 'baz'}]])
        expect(spy).toHaveBeenCalledTimes(1)
        add(4)
        expect(getSpyCalls()).toEqual([[{x: 'baz'}], [{x: 'baz'}]])
        expect(spy).toHaveBeenCalledTimes(2)
      },
    )
    test('handler works', () => {
      const release = createEvent()
      const emit = createEvent()
      const received = sample(emit, release, (last, payload) => [last, payload])
      received.watch(value => spy(value))
      release(0)
      emit(1)
      emit(2)
      release(3)
      release(4)
      emit(5)
      expect(getSpyCalls()).toEqual([[[2, 3]], [[2, 4]]])
    })
    test('store as clock', () => {
      const source = createEvent()
      const clock = createStore(0)
      const result = sample(source, clock)
      result.watch(value => spy(value))
      //$todo
      clock.setState(1)
      expect(spy).not.toHaveBeenCalled()
      source('run')
      expect(spy).not.toHaveBeenCalled()
      //$todo
      clock.setState(2)
      expect(getSpyCalls()).toEqual([['run']])
    })
    test('store as clock with handler', () => {
      const spy = jest.fn()
      const handler = jest.fn(x => x)
      const source = createEvent()
      const clock = createStore(0)
      const result = sample(source, clock, (source, clock) =>
        handler({
          source,
          clock,
        }),
      )
      result.watch(value => spy(value))
      //$todo
      clock.setState(1)
      expect(spy).not.toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled()
      source('run')
      expect(spy).not.toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled()
      //$todo
      clock.setState(2)
      expect(spy.mock.calls).toEqual([[{source: 'run', clock: 2}]])
      expect(handler.mock.calls).toEqual([[{source: 'run', clock: 2}]])
    })

    test('event source with store as target', () => {})
    test('event source with effect as target', () => {})
  })
  describe('sample with effect as source', () => {
    test('effect', () => {
      const data = createEffect('data', {
        handler() {
          return 'resolved'
        },
      })
      const stop = createEvent('stop')

      const lastData = sample(data, stop)

      lastData.watch(value => spy(value))

      data({foo: 'bar'})
      data(true)
      data(false)
      data({x: 'baz'})

      stop()

      expect(getSpyCalls()).toEqual([[{x: 'baz'}]])
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('support watchers as usual', async () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()
      const hello = createEffect({
        handler() {
          return Promise.resolve(200)
        },
      })
      const run = createEvent()

      sample(hello, run).watch(e => fn1(e))
      sample(hello.done, run).watch(e => fn2(e))

      await hello('test')

      run()
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
    })
    describe('event call will not break watchers', () => {
      it.each`
        greedy
        ${false}
        ${true}
      `(
        'event call will not break watchers (greedy = $greedy)',
        async ({greedy}) => {
          const fn1 = jest.fn()
          const hello = createEvent()
          const run = createEvent()

          //$todo
          sample(hello, run, (a, b) => ({a, b}), greedy).watch(e => {})
          //$todo
          sample(hello, run, (a, b) => ({a, b}), greedy).watch(e => fn1(e))

          run('R')
          hello('hello')

          run('RR')
          expect(fn1).toHaveBeenCalledTimes(1)
        },
      )
    })
    test('effect source with store as target', () => {})
    test('effect source with effect as target', () => {})
  })
  describe('sample with store as source', () => {
    test('store', () => {
      const inc = createEvent('inc')
      const dec = createEvent('dec')
      const stop = createEvent('stop')

      const s1 = createStore(0)
      const s2 = sample(s1, stop)

      s2.watch(value => spy(value))

      s1.on(inc, n => n + 1).on(dec, n => n - 1)

      inc()
      dec()
      inc()
      inc()

      stop()

      expect(getSpyCalls()).toEqual([[2]])
    })
    test('store has the same state as source', () => {
      const stop = createEvent()

      const s1 = createStore(0)
      //$todo
      s1.setState(1)

      const s2 = sample(s1, stop)
      s2.watch(e => spy(e))
      stop()
      expect(getSpyCalls()).toEqual([[1]])
    })

    test('store has its own defaultState', () => {
      const stop = createStore(0)

      const s1 = createStore(0)
      //$todo
      s1.setState(1)

      const s2 = sample(s1, stop)

      expect(s2.defaultState).toEqual(1)
    })

    test('store source with event as target plain', () => {
      const foo = createStore([1, 2, 3])
      const bar = createStore([4, 5, 6])
      const stop = createEvent()

      const baz = sample(bar, stop)

      foo.on(baz, (store1, store2) => [...store1, ...store2])

      stop(['stop'])
      expect(foo.getState()).toEqual([1, 2, 3, 4, 5, 6])
    })
    test('store source with effect as target', () => {})
  })
  test('store with handler', () => {
    const stop = createEvent()

    const s1 = createStore(0)
    //$todo
    s1.setState(1)

    const s2 = sample(s1, stop, (s1, stop) => ({s1, stop}))

    s2.watch(value => spy(value))
    expect(spy).toHaveBeenCalledTimes(0)
    //$todo
    s1.setState(2)

    stop('x')
    expect(getSpyCalls()).toEqual([[{s1: 2, stop: 'x'}]])
    expect(spy).toHaveBeenCalledTimes(1)
  })
  test('store x store x handler', () => {
    const stop = createStore(false)

    const s1 = createStore(0)
    //$todo
    s1.setState(1)

    const s2 = sample(s1, stop, (s1, stop) => ({s1, stop}))

    s2.watch(value => spy(value))
    expect(getSpyCalls()).toEqual([[{s1: 1, stop: false}]])
    //$todo
    s1.setState(2)
    //$todo
    s1.setState(0)

    //$todo
    stop.setState(true)
    expect(getSpyCalls()).toEqual([
      [{s1: 1, stop: false}],
      [{s1: 0, stop: true}],
    ])
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
