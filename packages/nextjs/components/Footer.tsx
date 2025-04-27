import React from "react";
import Link from "next/link";
import { hardhat } from "viem/chains";
import { CurrencyDollarIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { BuidlGuidlLogo } from "~~/components/assets/BuidlGuidlLogo";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useGlobalState } from "~~/services/store/store";

/**
 * Site footer
 */
export const Footer = () => {
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <div className="min-h-0 py-5 px-1 mt-8" style={{ backgroundColor: "#d1456f" }}>
      <div className="container mx-auto">
        <div className="flex flex-wrap justify-between items-center mb-5 px-4">
          <div className="flex flex-col md:flex-row gap-2 mb-3 md:mb-0">
            {nativeCurrencyPrice > 0 && (
              <div>
                <div className="btn btn-sm font-normal gap-1 cursor-auto text-white" style={{ backgroundColor: "#ff4791", borderColor: "#ff4791" }}>
                  <CurrencyDollarIcon className="h-4 w-4" />
                  <span>{nativeCurrencyPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
            {isLocalNetwork && (
              <>
                <Faucet />
                <Link href="/blockexplorer" passHref className="btn btn-sm font-normal gap-1 text-white" style={{ backgroundColor: "#ff4791", borderColor: "#ff4791" }}>
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Block Explorer</span>
                </Link>
              </>
            )}
          </div>
          <SwitchTheme />
        </div>
        
        <div className="w-full">
          <ul className="menu menu-horizontal w-full">
            <div className="flex justify-center items-center gap-2 text-sm w-full">
              <div className="text-center">
                <a href="https://github.com/scaffold-eth/se-2" target="_blank" rel="noreferrer" className="link text-white hover:text-pink-200">
                  Fork me
                </a>
              </div>
              <span className="text-white">·</span>
              <div className="flex justify-center items-center gap-2">
                <p className="m-0 text-center text-white">
                  Built with <HeartIcon className="inline-block h-4 w-4 text-pink-300" /> at
                </p>
                <a
                  className="flex justify-center items-center gap-1"
                  href="https://buidlguidl.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <BuidlGuidlLogo className="w-3 h-5 pb-1 text-white" />
                  <span className="link text-white hover:text-pink-200">BuidlGuidl</span>
                </a>
              </div>
              <span className="text-white">·</span>
              <div className="text-center">
                <a href="https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA" target="_blank" rel="noreferrer" className="link text-white hover:text-pink-200">
                  Support
                </a>
              </div>
            </div>
          </ul>
        </div>
      </div>
    </div>
  );
};