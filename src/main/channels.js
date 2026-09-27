// Curated YouTube channels (spec §3 seed list). Each is tagged with keyword domains so videos can
// be matched to topics. IDs are checked by scripts/verify-providers.js (the feed must answer and
// its title must match `name`). You can switch channels off or add your own in Settings.
const CHANNELS = [
  { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', name: 'Veritasium', domains: ['physics', 'mathematics', 'engineering', 'biology', 'psychology'] },
  { id: 'UCsXVk37bltHxD1rDPwtNM8Q', name: 'Kurzgesagt – In a Nutshell', domains: ['astronomy', 'biology', 'medicine', 'physics', 'philosophy'] },
  { id: 'UCYO_jab_esuFRV4b17AJtAw', name: '3Blue1Brown', domains: ['mathematics', 'computer-science', 'physics'] },
  { id: 'UC6nSFpj9HTCZ5t-N3Rm3-HA', name: 'Vsauce', domains: ['physics', 'mathematics', 'philosophy', 'psychology'] },
  { id: 'UC7_gcs09iThXybpVgjHZ_7g', name: 'PBS Space Time', domains: ['astronomy', 'physics', 'unsolved'] },
  { id: 'UCzR-rom72PHN9Zg7RML9EbA', name: 'PBS Eons', domains: ['biology', 'earth-science', 'nature'] },
  { id: 'UCoxcjq-8xIDTYp3uz647V5A', name: 'Numberphile', domains: ['mathematics', 'unsolved', 'logic'] },
  { id: 'UC9-y-6csu5WGm29I7JiwpnA', name: 'Computerphile', domains: ['computer-science', 'technology-history'] },
  { id: 'UCSju5G2aFaWMqn-_0YBtq5A', name: 'Stand-up Maths', domains: ['mathematics', 'unsolved'] },
  { id: 'UCR1IuLEqb6UEA_zQ81kwXfg', name: 'Real Engineering', domains: ['engineering', 'inventions', 'military-strategy'] },
  { id: 'UC9RM-iSvTu1uPJb8X5yp3EQ', name: 'Wendover Productions', domains: ['geography', 'economics', 'engineering'] },
  { id: 'UC6107grRI4m0o2-emgoDnAA', name: 'SmarterEveryDay', domains: ['physics', 'engineering', 'nature'] },
  { id: 'UCY1kMZp36IQSyNx_9h4mpCg', name: 'Mark Rober', domains: ['engineering', 'inventions', 'physics'] },
  { id: 'UCKzJFdi57J53Vr_BkTfN3uQ', name: 'Primer', domains: ['biology', 'economics', 'mathematics'] },
  { id: 'UCsooa4yRKGN_zEE8iknghZA', name: 'TED-Ed', domains: ['history', 'literature', 'biology', 'psychology', 'religion-mythology', 'philosophy'] },
  { id: 'UCZYTClx2T1of7BRZ86-8fow', name: 'SciShow', domains: ['biology', 'chemistry', 'medicine', 'neuroscience', 'nature'] },
  { id: 'UC2C_jShtL725hvbm1arSV9w', name: 'CGP Grey', domains: ['geography', 'law-politics', 'history'] },
  { id: 'UCBa659QWEk1AI4Tg--mrJ2A', name: 'Tom Scott', domains: ['linguistics', 'technology-history', 'geography', 'mysteries'] },
  { id: 'UCMmaBzfCCwZ2KqaBJjkj0fw', name: 'Kings and Generals', domains: ['military-strategy', 'history'] },
  { id: 'UCNIuvl7V8zACPpTmmNIqP2A', name: 'OverSimplified', domains: ['history', 'military-strategy'] },
  { id: 'UCv_vLHiWVBh_FR9vbeuiY-A', name: 'Historia Civilis', domains: ['history', 'law-politics', 'military-strategy'] },
  { id: 'UCX6b17PVsYBQ0ip5gyeme-Q', name: 'CrashCourse', domains: ['history', 'literature', 'economics', 'philosophy', 'psychology', 'chemistry'] },
  { id: 'UCl9StMQ79LtEvlrskzjoYbQ', name: 'Closer To Truth', domains: ['philosophy', 'unsolved', 'religion-mythology'] },
  { id: 'UCW39zufHfsuGgpLviKh297Q', name: 'DW Documentary', domains: ['history', 'geography', 'economics', 'latin-america'] },
  { id: 'UCijcd0GR0fkxCAZwkiuWqtQ', name: 'Free Documentary', domains: ['nature', 'history', 'geography'] },
  { id: 'UCwmZiChSryoWQCZMIQezgTg', name: 'BBC Earth', domains: ['nature', 'biology', 'earth-science'] },
  { id: 'UCSIvk78tK2TiviLQn4fSHaw', name: 'Up and Atom', domains: ['physics', 'mathematics', 'computer-science'] },
  { id: 'UCYNbYGl89UUowy8oXkipC-Q', name: 'Dr. Becky', domains: ['astronomy'] },
  { id: 'UCEIwxahdLz7bap-VDs9h35A', name: 'Steve Mould', domains: ['physics', 'engineering', 'chemistry'] },
  { id: 'UCMOqf8ab-42UUQIdVoKwjlQ', name: 'Practical Engineering', domains: ['engineering', 'earth-science'] },
  { id: 'UCdp4_l1vPmpN-gDbUwhaRUQ', name: 'Branch Education', domains: ['engineering', 'computer-science', 'inventions'] },
  { id: 'UC1LpsuAUaKoMzzJSEt5WImw', name: 'Asianometry', domains: ['technology-history', 'economics', 'engineering'] },
  { id: 'UCRcgy6GzDeccI7dkbbBna3Q', name: 'LEMMiNO', domains: ['mysteries', 'history'] },
  { id: 'UCePDFpCr78_qmVtpoB1Axaw', name: 'Great Art Explained', domains: ['art-history'] },
  { id: 'UCmGSJVG3mCRXVOP4yZrU1Dw', name: 'Johnny Harris', domains: ['geography', 'law-politics', 'history'] },
  { id: 'UC52kszkc08-acFOuogFl5jw', name: 'Tibees', domains: ['mathematics', 'physics'] },
];

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

/** Curated channels minus the ones switched off, plus your own. */
function activeChannels(settings) {
  const off = new Set(settings.channels?.disabled || []);
  const custom = (settings.channels?.custom || []).filter((c) => CHANNEL_ID.test(c.id));
  return [...CHANNELS.filter((c) => !off.has(c.id)), ...custom.map((c) => ({ ...c, custom: true, domains: c.domains || [] }))];
}

module.exports = { CHANNELS, CHANNEL_ID, activeChannels };
