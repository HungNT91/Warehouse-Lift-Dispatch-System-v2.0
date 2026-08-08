import React from 'react';
import { Search, Wrench, Globe } from 'lucide-react';

export function Lockdown404View() {
    return (
        <div className="fixed inset-0 z-[99999] bg-[#f2f7fd] flex flex-col items-center justify-center p-6 select-none overflow-hidden">
            {/* Background mountains / landscape abstract shapes in soft blue matching reference */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
                <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-sky-200/70 to-transparent rounded-t-[120%] transform scale-125" />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-72 bg-sky-100 rounded-t-full" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-80 bg-blue-100/70 rounded-t-full" />
            </div>

            <div className="max-w-3xl w-full text-center space-y-8 relative z-10 flex flex-col items-center">
                {/* Small top 404 label */}
                <div className="text-sky-400 font-mono text-sm tracking-[0.4em] font-bold uppercase opacity-90">
                    404
                </div>

                {/* Main 404 Visual Illustration Container */}
                <div className="relative py-12 flex items-center justify-center w-full">
                    {/* Globe in the sky */}
                    <div className="absolute top-2 right-16 w-20 h-20 rounded-full bg-sky-200/90 border border-sky-300 flex items-center justify-center text-sky-600 shadow-sm animate-pulse">
                        <Globe className="w-11 h-11 stroke-[1.5]" />
                    </div>

                    {/* Speech bubble "oops" */}
                    <div className="absolute top-4 left-24 bg-white px-4 py-1.5 rounded-3xl shadow-sm border border-sky-100 text-sky-500 text-xs font-bold tracking-wider animate-bounce">
                        oops
                    </div>

                    {/* Speech bubble "not found" */}
                    <div className="absolute top-6 right-36 bg-white px-4 py-1.5 rounded-3xl shadow-sm border border-sky-100 text-sky-500 text-xs font-bold tracking-wider">
                        not found
                    </div>

                    {/* Giant 404 Numbers */}
                    <div className="flex items-center justify-center gap-3 select-none">
                        {/* First 4 */}
                        <span className="text-9xl md:text-[14rem] font-black text-blue-600 tracking-tighter drop-shadow-lg font-mono leading-none">
                            4
                        </span>

                        {/* Zero with character holding magnifying glass */}
                        <div className="relative flex items-center justify-center">
                            <span className="text-8xl md:text-9xl font-black text-blue-600 tracking-tighter drop-shadow-md font-mono">
                                0
                            </span>
                            {/* Character 1 (Left) with magnifying glass */}
                            <div className="absolute -left-8 bottom-3 flex flex-col items-center">
                                <div className="w-4 h-4 rounded-full bg-sky-700 mb-0.5 shadow-xs" />
                                <div className="w-6 h-10 bg-blue-600 rounded-t-xl flex items-center justify-center shadow-sm">
                                    <Search className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Second 4 */}
                        <span className="text-9xl md:text-[14rem] font-black text-blue-600 tracking-tighter drop-shadow-lg font-mono leading-none">
                            4
                        </span>
                    </div>

                    {/* Character 2 (Right) with wrench fixing plug */}
                    <div className="absolute bottom-3 right-32 flex items-center gap-1.5">
                        <div className="flex flex-col items-center">
                            <div className="w-3.5 h-3.5 rounded-full bg-sky-700 mb-0.5 shadow-xs" />
                            <div className="w-5 h-9 bg-blue-600 rounded-t-xl shadow-sm" />
                        </div>
                        <Wrench className="w-6 h-6 text-sky-700 transform -rotate-45" />
                    </div>
                </div>

                {/* Plant / flower decorations */}
                <div className="flex items-center justify-center gap-16 opacity-90 pt-4">
                    <div className="w-2 h-10 bg-emerald-500 rounded-full relative shadow-xs">
                        <div className="absolute -top-2.5 -left-2 w-4 h-4 rounded-full bg-orange-400 shadow-xs" />
                    </div>
                    <div className="w-2 h-12 bg-emerald-500 rounded-full relative shadow-xs">
                        <div className="absolute -top-3 -left-2.5 w-5 h-5 rounded-full bg-orange-500 shadow-xs" />
                    </div>
                </div>
            </div>
        </div >
    );
}
