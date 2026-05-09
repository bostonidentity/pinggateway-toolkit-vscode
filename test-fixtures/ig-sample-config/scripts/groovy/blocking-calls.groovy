// Triggers IG-001 (line 6), IG-002 (line 7), IG-003 (line 8) — 3 ERRORs.
package com.example.test

class BlockingHandler {
    def fetch(promise, future, anotherFuture) {
        def result = promise.get()
        def value = future.getOrThrow(timeout)
        def safe = anotherFuture.getOrThrowUninterruptibly()
        return [result, value, safe]
    }
}
