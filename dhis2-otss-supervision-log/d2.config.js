/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'otss-supervision-log',
    title: 'OTSS Supervision Log',
    description:
        'A supportive-supervision checklist for DHIS2, structured around the real OTSS (Outreach Training and Supportive Supervision) model from Burnett et al. 2019 -- tracks both checklist completeness and clinical competency per facility visit.',

    coreCompatibility: '>=2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'otssSupervisionLog',

    direction: 'auto',
}

module.exports = config
