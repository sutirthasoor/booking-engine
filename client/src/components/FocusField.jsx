import { css } from '../utils/css';

const base = 'width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: all 0.2s; outline: none;';

const focus = (e) => {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
};
const blur = (e) => {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow = 'none';
};

/** Input/textarea with the blue focus ring of the original form fields. */
export default function FocusField({ as = 'input', extraStyle = '', ...props }) {
  const Tag = as;
  return <Tag {...props} style={css(base + extraStyle)} onFocus={focus} onBlur={blur} />;
}
