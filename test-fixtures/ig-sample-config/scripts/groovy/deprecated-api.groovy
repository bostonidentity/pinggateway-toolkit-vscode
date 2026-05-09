// Triggers IG-101, IG-103, IG-104, IG-106, IG-107, IG-108, IG-201.
package com.example.test

import org.forgerock.util.time.Duration

class DeprecatedApiUsage {
    def handle(request) {
        def params = request.form
        def conn = ldap.search('uid=test')
        def jwt = new JwtSession()
        def t = _token('user.name')
        def t2 = TokenResolver.resolve('x')
        def oauthUri = request.uri + '/oauth/token'
        if (matches(request.headers, /admin/)) {
            return 'allow'
        }
        def d = Duration.duration('5s')
        return [params, conn, jwt, t, t2, oauthUri, d]
    }
}
