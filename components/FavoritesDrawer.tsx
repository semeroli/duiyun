"use client";

/**
 * 收藏抽屉
 * 存的是浏览器本地（localStorage），不联网、不上传，隐私模式下也能用。
 */

import { motion } from "framer-motion";
import type { FavoriteItem } from "@/lib/storage";
import { KIND_META, sourceLabel } from "@/lib/types";
import { Btn, Drawer } from "./ui";

export default function FavoritesDrawer({
  open,
  onClose,
  favorites,
  onLoad,
  onRemove,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  favorites: FavoriteItem[];
  onLoad: (f: FavoriteItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="我的收藏"
      subtitle={favorites.length ? `共 ${favorites.length} 副 · 存在本机浏览器` : "还没有收藏"}
      widthClass="w-full max-w-lg"
    >
      {favorites.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-song text-[18px] tracking-[.16em] text-inkFaint/85">
            未录一字，静待佳句
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-inkFaint">
            遇到满意的下联，点一下「收藏」，它就留在这里了。
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <Btn size="sm" variant="ghost" onClick={onClear} title="清空全部收藏">
              清空全部
            </Btn>
          </div>
          <ul className="space-y-2.5">
            {favorites.map((f, i) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}
                className="rounded-md border border-line bg-panelSolid/50 px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-song text-[15px] leading-relaxed tracking-[.1em] text-ink">
                      {f.upper}
                    </p>
                    <p className="font-song text-[15px] leading-relaxed tracking-[.1em] text-cinnabar">
                      {f.lower}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-inkFaint">
                      <span>{KIND_META[f.kind]?.label ?? f.kind}</span>
                      {f.source && <span>· {sourceLabel(f.source)}</span>}
                      <span>· {new Date(f.at).toLocaleDateString("zh-CN")}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Btn size="sm" variant="outline" onClick={() => onLoad(f)} title="载入到主界面">
                      载入
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => onRemove(f.id)} title="删除这一条">
                      删除
                    </Btn>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  );
}
