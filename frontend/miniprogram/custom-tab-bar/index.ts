Component({
  data: {
    selected: 0,
    tabs: [
      { pagePath: '/pages/feed/index', text: '广场', icon: '⌂' },
      { pagePath: '/pages/publish/index', text: '发布', icon: '＋' },
      { pagePath: '/pages/my/index', text: '我的', icon: '◉' }
    ]
  },

  methods: {
    switchTab(event: WechatMiniprogram.BaseEvent) {
      const index = Number(event.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (tab) {
        wx.switchTab({ url: tab.pagePath });
      }
    }
  }
});
