include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-airouter
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=Hiveton <hiveton@example.com>
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-airouter
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=AI Router Assistant (Claude/OpenAI/Gemini/DeepSeek)
  DEPENDS:=+curl +ca-bundle +jq +luci-base
  PKGARCH:=all
endef

define Package/luci-app-airouter/description
  Provides an AI-powered router management assistant integrated into the
  LuCI web interface. Supports multiple LLM providers (OpenAI, DeepSeek,
  Anthropic Claude, Google Gemini) with tool-calling capabilities for
  UCI configuration and shell command execution.
endef

define Build/Compile
endef

define Package/luci-app-airouter/install
	# LuCI JS views
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/airouter
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/airouter/*.js \
		$(1)/www/luci-static/resources/view/airouter/

	# LuCI menu registration
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-airouter.json \
		$(1)/usr/share/luci/menu.d/

	# ACL permissions
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-airouter.json \
		$(1)/usr/share/rpcd/acl.d/

	# RPCD plugin
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/luci.airouter \
		$(1)/usr/libexec/rpcd/

	# AI Router backend scripts
	$(INSTALL_DIR) $(1)/usr/lib/ai-router/providers
	$(INSTALL_BIN) ./root/usr/lib/ai-router/agent.sh $(1)/usr/lib/ai-router/
	$(INSTALL_BIN) ./root/usr/lib/ai-router/history.sh $(1)/usr/lib/ai-router/
	$(INSTALL_BIN) ./root/usr/lib/ai-router/tools.sh $(1)/usr/lib/ai-router/
	$(INSTALL_BIN) ./root/usr/lib/ai-router/providers/*.sh \
		$(1)/usr/lib/ai-router/providers/

	# Default UCI config
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/airouter $(1)/etc/config/

	# History directory
	$(INSTALL_DIR) $(1)/etc/ai-router
endef

define Package/luci-app-airouter/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	# Initialize empty history
	[ -f /etc/ai-router/history.json ] || echo '[]' > /etc/ai-router/history.json
	# Restart rpcd to pick up the new plugin
	/etc/init.d/rpcd restart
	# Clear LuCI cache
	rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
}
endef

$(eval $(call BuildPackage,luci-app-airouter))
