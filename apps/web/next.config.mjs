/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Detail pages are unambiguously Utah resources — permanent (308).
      {
        source: "/programs/:slug",
        destination: "/utah/programs/:slug",
        permanent: true,
      },
      {
        source: "/courses/:code",
        destination: "/utah/courses/:code",
        permanent: true,
      },
      // Index pages stay temporary (307): browsers cache 308s forever and
      // bare /programs is a plausible future school picker.
      {
        source: "/programs",
        destination: "/utah/programs",
        permanent: false,
      },
      {
        source: "/courses",
        destination: "/utah/courses",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
