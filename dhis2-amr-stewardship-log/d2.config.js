/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'amr-stewardship-log',
    title: 'AMR Stewardship Log',
    description:
        'A point-of-care antibiotic prescribing checklist, aligned to WHO AWaRe (Access/Watch/Reserve), that flags Watch/Reserve prescriptions as needing a justification note.',

    coreCompatibility: '>=2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'amrStewardshipLog',

    direction: 'auto',
}

module.exports = config
