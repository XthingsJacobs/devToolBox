import JavaScriptObfuscator from 'javascript-obfuscator';

export function obfuscateJavaScript(input: string): string {
  const result = JavaScriptObfuscator.obfuscate(input, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    stringArray: true,
    stringArrayThreshold: 0.5,
    renameGlobals: false,
  });
  return result.getObfuscatedCode();
}
