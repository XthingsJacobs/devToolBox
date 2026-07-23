import { type ChangeEvent } from 'react';
import { VscShield } from 'react-icons/vsc';
import { ToolButton, ToolField, ToolInput, ToolSection, ToolTextarea } from '@@components';
import { Block, JsonBlock, VerifyBadges } from './JwtBlocks';
import type { JwtCopyHandler, JwtLocaleText } from './JwtTool.types';
import { useOidcJwtVerifier } from './useOidcJwtVerifier';
import styles from './JwtTool.module.css';

export function JwtOidcPanel({ mt, onCopy }: { mt: JwtLocaleText; onCopy: JwtCopyHandler }) {
  const oidc = useOidcJwtVerifier(mt);

  return (
    <ToolSection
      title={mt('tabVerifyOidc')}
      icon={<VscShield />}
      accentColor="#3498db"
      actions={
        <ToolButton variant="primary" onClick={oidc.verify} disabled={!oidc.token.trim() || oidc.busy}>
          {oidc.busy ? mt('oidcVerifying') : mt('oidcVerifyBtn')}
        </ToolButton>
      }
    >
      <ToolTextarea
        mono
        value={oidc.token}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => oidc.setToken(event.target.value)}
        placeholder={mt('inputPlaceholder')}
        spellCheck={false}
        rows={2}
      />
      <div className={styles.optionsRow}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={oidc.auto}
            onChange={(event) => oidc.setAuto(event.target.checked)}
          />
          {mt('oidcAuto')}
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={oidc.allowHttp}
            onChange={(event) => oidc.setAllowHttp(event.target.checked)}
          />
          {mt('oidcAllowHttp')}
        </label>
      </div>
      <div className={styles.row}>
        <ToolField label={mt('oidcAud')}>
          <ToolInput
            value={oidc.audience}
            onChange={(event: ChangeEvent<HTMLInputElement>) => oidc.setAudience(event.target.value)}
            placeholder={mt('oidcAudPlaceholder')}
            spellCheck={false}
          />
        </ToolField>
        <ToolField label={mt('oidcSkew')}>
          <ToolInput
            value={oidc.skew}
            onChange={(event: ChangeEvent<HTMLInputElement>) => oidc.setSkew(event.target.value)}
            placeholder="120"
            spellCheck={false}
          />
        </ToolField>
      </div>
      {oidc.info?.issuer && (
        <div className={styles.oidcMeta}>
          <div>{mt('oidcIssuer') + ': ' + oidc.info.issuer}</div>
          {oidc.info.jwksUri && <div>{mt('oidcJwksUri') + ': ' + oidc.info.jwksUri}</div>}
        </div>
      )}
      <VerifyBadges messages={oidc.result} />
      {oidc.decoded && (
        <div className={styles.grid}>
          <JsonBlock
            title={mt('header')}
            value={oidc.decoded.header}
            copyLabel={mt('copy')}
            onCopy={() => onCopy(oidc.decoded?.header ?? '')}
          />
          <JsonBlock
            title={mt('payload')}
            value={oidc.decoded.payload}
            copyLabel={mt('copy')}
            onCopy={() => onCopy(oidc.decoded?.payload ?? '')}
          />
        </div>
      )}
      {oidc.decoded && (
        <Block
          title={mt('signature')}
          copyLabel={mt('copy')}
          onCopy={() => onCopy(oidc.decoded?.signature ?? '')}
        >
          <code className={styles.sig}>{oidc.decoded.signature}</code>
        </Block>
      )}
      {oidc.jwksKey && (
        <JsonBlock
          title={`${mt('jwksKey')}${oidc.jwksKid ? ` (${oidc.jwksKid})` : ''}`}
          value={oidc.jwksKey}
          copyLabel={mt('copy')}
          onCopy={() => onCopy(oidc.jwksKey ?? '')}
        />
      )}
    </ToolSection>
  );
}
