/* eslint-disable @next/next/no-img-element */
import type {ReactNode} from "react";

type AuthShellProps = {
    mode: "login" | "registration";
    subtitle: string;
    title: string;
    imageSrc: string;
    imageAlt: string;
    secondaryImageSrc?: string;
    children: ReactNode;
};

export default function AuthShell({
                                      mode,
                                      subtitle,
                                      title,
                                      imageSrc,
                                      imageAlt,
                                      secondaryImageSrc,
                                      children,
                                  }: AuthShellProps) {
    const isLogin = mode === "login";

    return (
        <section
            className={
                isLogin
                    ? "_social_login_wrapper _layout_main_wrapper"
                    : "_social_registration_wrapper _layout_main_wrapper"
            }
        >
            <div className="_shape_one">
                <img src="/assets/images/shape1.svg" alt="" className="_shape_img"/>
                <img src="/assets/images/dark_shape.svg" alt="" className="_dark_shape"/>
            </div>

            <div className="_shape_two">
                <img src="/assets/images/shape2.svg" alt="" className="_shape_img"/>
                <img
                    src="/assets/images/dark_shape1.svg"
                    alt=""
                    className="_dark_shape _dark_shape_opacity"
                />
            </div>

            <div className="_shape_three">
                <img src="/assets/images/shape3.svg" alt="" className="_shape_img"/>
                <img
                    src="/assets/images/dark_shape2.svg"
                    alt=""
                    className="_dark_shape _dark_shape_opacity"
                />
            </div>

            <div className={isLogin ? "_social_login_wrap" : "_social_registration_wrap"}>
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-xl-8 col-lg-8 col-md-12 col-sm-12">
                            {isLogin ? (
                                <div className="_social_login_left">
                                    <div className="_social_login_left_image">
                                        <img src={imageSrc} alt={imageAlt} className="_left_img"/>
                                    </div>
                                </div>
                            ) : (
                                <div className="_social_registration_right">
                                    <div className="_social_registration_right_image">
                                        <img src={imageSrc} alt={imageAlt}/>
                                    </div>
                                    {secondaryImageSrc ? (
                                        <div className="_social_registration_right_image_dark">
                                            <img src={secondaryImageSrc} alt=""/>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <div className="col-xl-4 col-lg-4 col-md-12 col-sm-12">
                            <div
                                className={
                                    isLogin ? "_social_login_content" : "_social_registration_content"
                                }
                            >
                                <div
                                    className={
                                        isLogin
                                            ? "_social_login_left_logo _mar_b28"
                                            : "_social_registration_right_logo _mar_b28"
                                    }
                                >
                                    <img
                                        src="/assets/images/logo.svg"
                                        alt="Buddy Script"
                                        className={isLogin ? "_left_logo" : "_right_logo"}
                                    />
                                </div>

                                <p
                                    className={
                                        isLogin
                                            ? "_social_login_content_para _mar_b8"
                                            : "_social_registration_content_para _mar_b8"
                                    }
                                >
                                    {subtitle}
                                </p>

                                <h1
                                    className={
                                        isLogin
                                            ? "_social_login_content_title _titl4 _mar_b50"
                                            : "_social_registration_content_title _titl4 _mar_b50"
                                    }
                                >
                                    {title}
                                </h1>

                                <button
                                    type="button"
                                    disabled
                                    className={
                                        isLogin
                                            ? "_social_login_content_btn _mar_b40"
                                            : "_social_registration_content_btn _mar_b40"
                                    }
                                >
                                    <img src="/assets/images/google.svg" alt="" className="_google_img"/>
                                    <span>
                                        {isLogin ? "Or sign-in with google" : "Register with google"}
                                  </span>
                                </button>

                                <div
                                    className={
                                        isLogin
                                            ? "_social_login_content_bottom_txt _mar_b40"
                                            : "_social_registration_content_bottom_txt _mar_b40"
                                    }
                                >
                                    <span>Or</span>
                                </div>

                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
