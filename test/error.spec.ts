import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { pipe } from 'it-pipe'
import defer from 'p-defer'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { isNode } from 'wherearewe'
import * as WS from '../src/index.js'
import WebSocket from '../src/web-socket.js'

describe('error', () => {
  // connect to a server that does not exist, and check that it errors.
  // should pass the error to both sides of the stream.
  it('test error', async () => {
    const input = [
      uint8ArrayFromString('x'),
      uint8ArrayFromString('y'),
      uint8ArrayFromString('z')
    ]
    let sinkError: Error | null = null
    let sourceError: Error | null = null
    const deferred = defer()

    await pipe(
      input,
      source => {
        const stream = WS.duplex(new WebSocket(`ws://localhost:34897/${Math.random()}`))
        stream.sink(source).catch(err => {
          sinkError = err
          deferred.resolve()
        })
        return stream.source
      },
      async function * (source) {
        try {
          for await (const val of source) yield val
        } catch (err: any) {
          sourceError = err
        }
      },
      drain
    )

    // make sure the sink has had time to error
    await deferred.promise

    if (sinkError == null || sourceError == null) {
      throw new Error('Sink and/or source error not found')
    }

    // @ts-expect-error sinkError/sourceError were set above
    expect(sinkError.message).to.equal(sourceError.message)
  })

  // ws under node throws AggregateErrors
  if (isNode) {
    it('test connection error awaiting connected', async () => {
      await expect(
        WS.duplex(new WebSocket(`ws://localhost:34897/${Math.random()}`)).connected()
      ).to.eventually.be.rejected.with.nested.property('errors[0].message').that.matches(/ECONNREFUSED/g)
    })

    it('test connection error in stream', async function () {
      await expect(
        pipe(
          WS.duplex(new WebSocket(`ws://localhost:34897/${Math.random()}`)).source,
          drain
        )
      ).to.eventually.be.rejected.with.nested.property('errors[0].message').that.matches(/ECONNREFUSED/g)
    })
  } else {
    it('test connection error awaiting connected', async () => {
      await expect(
        WS.duplex(new WebSocket(`ws://localhost:34897/${Math.random()}`)).connected()
      ).to.eventually.be.rejected.with.property('message').that.matches(/ECONNREFUSED/g)
    })

    it('test connection error in stream', async function () {
      await expect(
        pipe(
          WS.duplex(new WebSocket(`ws://localhost:34897/${Math.random()}`)).source,
          drain
        )
      ).to.eventually.be.rejected.with.property('message').that.matches(/ECONNREFUSED/g)
    })
  }
})
