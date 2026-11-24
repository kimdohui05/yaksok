// 약 카테고리: 사용자가 지정한 값(localStorage) → 없으면 약 이름 키워드로 추정
export const CATEGORIES = [
  { key: '해열·진통', color: '#2FB6D1', bg: '#E3F6FA' },
  { key: '소염·진통', color: '#E07A3F', bg: '#FDEFE6' },
  { key: '감기·호흡기', color: '#4F8EDC', bg: '#E8F1FC' },
  { key: '소화·위장', color: '#3BA776', bg: '#E5F6EE' },
  { key: '혈압·심혈관', color: '#E05A6A', bg: '#FCE9EC' },
  { key: '당뇨', color: '#9A6ADB', bg: '#F1EBFB' },
  { key: '항생제', color: '#C9862B', bg: '#FBF1E1' },
  { key: '알레르기', color: '#D35FA6', bg: '#FBEAF4' },
  { key: '수면·신경', color: '#5B6BC9', bg: '#ECEEFA' },
  { key: '영양제', color: '#5EA83B', bg: '#EDF7E6' },
  { key: '기타', color: '#8AA4AF', bg: '#EEF3F5' },
]

const RULES = [
  ['소염·진통', /이부프로펜|부루펜|애드빌|덱시부프로펜|나프록센|록소프로펜|록소닌|탁센|이지엔|세레콕시브|쎄레브렉스|디클로페낙|소염/],
  ['해열·진통', /타이레놀|아세트아미노펜|펜잘|게보린|아스피린|해열|진통/],
  ['감기·호흡기', /감기|콜드|판콜|코대원|기침|시럽|슈다페드|뮤코|암브록솔|화이투벤/],
  ['소화·위장', /소화|베아제|훼스탈|겔포스|개비스콘|위장|가스|판토|오메프라졸|에소메프라졸|란소|라베프라졸|무코스타|레바미피드/],
  ['혈압·심혈관', /혈압|암로디핀|노바스크|로사르탄|코자|발사르탄|텔미사르탄|아토르바스타틴|리피토|로수바스타틴|크레스토|클로피도그렐|플라빅스/],
  ['당뇨', /당뇨|메트포르민|다이아벡스|자누비아|시타글립틴|글리메피리드|아마릴/],
  ['항생제', /항생|아목시실린|오구멘틴|세팔로스포린|세파|클래리스로마이신|아지스로마이신|레보플록사신/],
  ['알레르기', /알레르기|지르텍|세티리진|알레그라|펙소페나딘|로라타딘|클라리틴|코메키나/],
  ['수면·신경', /수면|졸피뎀|스틸녹스|멜라토닌|신경안정|알프라졸람|자낙스|로라제팜/],
  ['영양제', /비타민|오메가|유산균|프로바이오틱스|마그네슘|칼슘|철분|루테인|아연|밀크씨슬/],
]

const STORAGE_KEY = 'medCategoryByName'

const loadOverrides = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

export const guessCategory = (name = '') => {
  const found = RULES.find(([, re]) => re.test(name))
  return found ? found[0] : '기타'
}

export const getCategory = (name = '') => loadOverrides()[name] || guessCategory(name)

export const setCategory = (name, category) => {
  if (!name) return
  const map = loadOverrides()
  if (category) map[name] = category
  else delete map[name]
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)) } catch {}
}

export const categoryStyle = (key) => {
  const c = CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1]
  return { color: c.color, background: c.bg }
}

// 함께 복용 시 주의가 필요한 조합 (NSAID 중복 등) — 클라이언트 단순 규칙
const NSAID = /아스피린|이부프로펜|부루펜|애드빌|덱시부프로펜|나프록센|록소프로펜|록소닌|탁센|이지엔|디클로페낙/

export const findInteractions = (names = []) => {
  const unique = [...new Set(names)]
  const nsaids = unique.filter(n => NSAID.test(n))
  if (nsaids.length < 2) return []
  return [{
    meds: nsaids,
    message: `${nsaids.join(' + ')}을(를) 함께 복용하면 위장 출혈 위험이 커질 수 있어요.`,
  }]
}
