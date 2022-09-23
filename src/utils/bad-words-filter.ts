import Filter from 'bad-words'

const filter = new Filter({ emptyList: true })
const badWords: string[] = [
    'fuck',
    'shit',
    'ass',
    'cunt',
    'asshole',
    'assh0le',
    'assh0lez',
    'bitch',
    'bitches',
    'cock',
    'c0ck',
    'c0cks',
    'cunts',
    'cum',
    'f u c k',
    'f u c k e r',
    'fucker',
    'fucking',
    'faggot',
    'fag',
    'dyke',
    'whore',
    'nigger',
    'nigga',
    'pussy',
    'slut',
    'chink',
    'kike',
]

filter.addWords(...badWords)
export default filter
