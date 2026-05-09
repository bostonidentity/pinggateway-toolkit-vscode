import { Rule } from './types';

export const RULES: Rule[] = [
  // === Groovy 4 errors (0xx) — applied to .groovy ===
  {
    id: 'G4-001', severity: 'ERROR',
    pattern: /import\s+groovy\.util\.XmlSlurper/,
    message: 'groovy.util.XmlSlurper removed in Groovy 4',
    fix: 'Change to: import groovy.xml.XmlSlurper',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-002', severity: 'ERROR',
    pattern: /import\s+groovy\.util\.XmlParser/,
    message: 'groovy.util.XmlParser removed in Groovy 4',
    fix: 'Change to: import groovy.xml.XmlParser',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-003', severity: 'ERROR',
    pattern: /import\s+groovy\.util\.GroovyTestCase/,
    message: 'groovy.util.GroovyTestCase removed in Groovy 4',
    fix: 'Change to: import groovy.test.GroovyTestCase',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-004', severity: 'ERROR',
    pattern: /import\s+groovy\.util\.AntBuilder/,
    message: 'groovy.util.AntBuilder removed in Groovy 4',
    fix: 'Change to: import groovy.ant.AntBuilder',
    appliesTo: ['groovy'],
  },

  // === Groovy 4 warnings (1xx) ===
  {
    id: 'G4-101', severity: 'WARN',
    pattern: /\.intersect\(/,
    message: 'intersect() now draws elements from 1st collection (was 2nd in Groovy 3)',
    fix: 'Verify the result is still correct with the new semantics',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-102', severity: 'WARN',
    pattern: /(?:Object\s*\[\s*\]\s+\w+|def\s+\w+)\s*=\s*\w+\s*\+\s*\w+/,
    message: 'Array addition (b + c) now returns same type as b, was Object[] in Groovy 3',
    fix: 'Verify array concatenation results; use explicit typing or .union()',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-103', severity: 'WARN',
    pattern: /catch\s*\(\s*Exception\s+\w+\s*\).*[Ss]ql|Sql\..*\.call\(/,
    message: 'Sql#call variants now throw SQLException instead of Exception',
    fix: 'Change catch blocks to catch (SQLException e)',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-104', severity: 'WARN',
    pattern: /@\s*Field\s+private|private\s+\w+\s+\w+.*=.*\{/,
    message: 'Private field access in closures may break in Groovy 4',
    fix: 'Use @CompileStatic or change to protected',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-105', severity: 'WARN',
    pattern: /import\s+groovy\.util\.\*/,
    message: 'groovy.util.* wildcard import may pull in removed classes',
    fix: 'Replace with specific imports from groovy.xml, groovy.test, groovy.ant',
    appliesTo: ['groovy'],
  },

  // === Groovy 4 info (2xx) ===
  {
    id: 'G4-201', severity: 'INFO',
    pattern: /[=!]=\s*0\.0[fd]?\b|0\.0[fd]?\s*[=!]=/,
    message: 'Groovy 4 now distinguishes 0.0f and -0.0f',
    fix: 'Use equalsIgnoreZeroSign or NumberAwareComparator if old behavior needed',
    appliesTo: ['groovy'],
  },
  {
    id: 'G4-202', severity: 'INFO',
    pattern: /\.getProperties\(\)/,
    message: 'getProperties() now also returns public fields in Groovy 4',
    fix: 'Verify property iteration does not expose unintended fields',
    appliesTo: ['groovy'],
  },

  // === PingGateway errors (0xx) — blocking calls ===
  {
    id: 'IG-001', severity: 'ERROR',
    pattern: /(?:promise|Promise|future|Future)\w*\.get\(\s*\)/,
    message: 'Blocking Promise.get() can cause deadlocks in PingGateway',
    fix: 'Use .thenOnResult() or .thenAsync() instead',
    appliesTo: ['groovy'],
  },
  {
    id: 'IG-002', severity: 'ERROR',
    pattern: /\.getOrThrow\(/,
    message: 'Blocking Promise.getOrThrow() can cause deadlocks',
    fix: 'Use .thenOnResult() or .thenAsync() instead',
    appliesTo: ['groovy'],
  },
  {
    id: 'IG-003', severity: 'ERROR',
    pattern: /\.getOrThrowUninterruptibly\(/,
    message: 'Blocking Promise.getOrThrowUninterruptibly() can cause deadlocks',
    fix: 'Use .thenOnResult() or .thenAsync() instead',
    appliesTo: ['groovy'],
  },

  // === PingGateway warnings (1xx) — script + JSON deprecations ===
  {
    id: 'IG-101', severity: 'WARN',
    pattern: /request\.form\b/,
    message: 'request.form is deprecated in PingGateway',
    fix: 'Use Request.getQueryParams() and Entity.getForm() / Entity.setForm()',
    appliesTo: ['groovy'],
  },
  {
    id: 'IG-102', severity: 'WARN',
    pattern: /"matches"\s*:|'matches'\s*:/,
    message: 'matches() deprecated in PingGateway 2024.11',
    fix: 'Replace with find() or matchesWithRegex()',
    appliesTo: ['json'],
  },
  {
    id: 'IG-103', severity: 'WARN',
    pattern: /\bldap\b\s*\.|LdapClient/,
    message: 'ldap script binding and LdapClient deprecated since IG 7.1',
    fix: 'Remove or replace with alternative LDAP access method',
    appliesTo: ['groovy'],
  },
  {
    id: 'IG-104', severity: 'WARN',
    pattern: /JwtSession\b/,
    message: 'JwtSession object deprecated in PingGateway 2024.11',
    fix: "Use JwtSessionManager for the 'session' property instead",
    appliesTo: ['groovy', 'json'],
  },
  {
    id: 'IG-105', severity: 'WARN',
    pattern: /"Session"\s*:/,
    message: "Using 'Session' key (uppercase) deprecated in 2024.11",
    fix: "Use lowercase 'session' property instead",
    appliesTo: ['json'],
  },
  {
    id: 'IG-106', severity: 'WARN',
    pattern: /\b_token\s*\(|\b_t\s*\(|TokenResolver\b/,
    message: 'TokenResolver and _token()/_t() deprecated in PingGateway 2024.6',
    fix: 'Use expression format &{...} instead',
    appliesTo: ['groovy', 'json'],
  },
  {
    id: 'IG-107', severity: 'WARN',
    pattern: /request\.uri\b.*(?:OAuth|oauth|token)/,
    message: 'request.uri in OAuth2 filter context deprecated in 2023.9',
    fix: 'Use IdpSelectionLoginContext instead',
    appliesTo: ['groovy'],
  },
  {
    id: 'IG-108', severity: 'WARN',
    pattern: /\bmatches\s*\(\s*request\./,
    message: 'matches() deprecated in PingGateway 2024.11',
    fix: 'Replace with find() or matchesWithRegex()',
    appliesTo: ['groovy'],
  },

  // === PingGateway info (2xx) ===
  {
    id: 'IG-201', severity: 'INFO',
    pattern: /org\.forgerock\.util\.time\.Duration/,
    message: 'org.forgerock.util.time.Duration deprecated in PingGateway',
    fix: 'Use java.time.Duration instead',
    appliesTo: ['groovy'],
  },

  // === Security checks (SEC) — apply to both .groovy and .json ===
  {
    id: 'SEC-101', severity: 'WARN',
    pattern: /["'][^"']*secret\.id[^"']*["']\s*:\s*["'][^"'$&{]{3,}["']/,
    message: 'ForgeRock secret.id with possible hardcoded value',
    fix: 'Ensure secret is resolved via a secret store, not hardcoded',
    appliesTo: ['groovy', 'json'],
  },
  {
    id: 'SEC-103', severity: 'WARN',
    pattern: /(?:password|passwd|pwd|passphrase|secret|apikey|api_key|credential|private_key|client_secret|storepass|keypass)\s*=\s*["'][^"'$&{]{3,}["']/,
    message: 'Possible hardcoded credential in script',
    fix: 'Use environment variable or secret store',
    appliesTo: ['groovy', 'json'],
  },

  // === Path checks (PATH) — apply to both ===
  {
    id: 'PATH-101', severity: 'WARN',
    pattern: /catalina\.base|catalina\.home|\/webapps\/ROOT|\/tomcat\d+\/|servlet[_-]?api/,
    message: 'Reference to Tomcat environment path',
    fix: 'Update to new PingGateway standalone path',
    appliesTo: ['groovy', 'json'],
  },
  {
    id: 'PATH-102', severity: 'INFO',
    pattern: /(?<![a-zA-Z])\/(?:opt|home|etc|var|usr|tmp|srv|root|mnt|media|boot|run)\/[a-zA-Z0-9._${}/-]+/,
    message: 'Absolute filesystem path — may not be valid after migration',
    fix: 'Verify path exists in new environment',
    appliesTo: ['groovy', 'json'],
  },
  {
    id: 'PATH-103', severity: 'INFO',
    pattern: /["'](?:\.\.\/)+[^"']*["']/,
    message: 'Relative path referencing outside project directory',
    fix: 'Verify the referenced file is accessible from new IG location',
    appliesTo: ['groovy', 'json'],
  },
];

// Rule IDs created by procedural checks (not in RULES)
export const PROCEDURAL_RULE_DESCS: Record<string, string> = {
  'G4-106': 'Removed class usage outside imports',
  'RT-001': 'Duplicate JSON key in route file',
  'RT-002': 'Missing required config field',
  'RT-101': 'Duplicate route name',
  'RT-102': 'Deprecated matches() in route condition',
  'RT-103': 'Deprecated matches() / blocking .get() in inline expression',
  'REF-001': 'Dangling script reference (file does not exist)',
  'REF-002': 'Orphan script (not referenced by any route)',
};

// Required config fields for IG type detection (RT-002)
export const REQUIRED_FIELDS: Record<string, string[]> = {
  UserProfileFilter: ['config/username'],
  ScriptableFilter: ['config/type'],
  ScriptableHandler: ['config/type'],
  AmService: ['config/url', 'config/agent'],
  StaticResponseHandler: ['config/status'],
};
