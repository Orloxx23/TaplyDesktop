module.exports = {
  packagerConfig: {
    icon: './icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        iconUrl: 'https://cdn.discordapp.com/attachments/1086083782324523159/1086701311510204436/icon.ico',
        setupIcon: './icon.ico',
        authors: 'Orloxx',
        name: 'Taply',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './icon.png',
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
};
